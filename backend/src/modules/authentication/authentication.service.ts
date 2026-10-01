import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { verify } from '@node-rs/argon2';
import type { User } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.schema';
import { AuthSessionRepository, hashRefreshId } from './auth-session.repository';
import { MultiFactorService } from './multi-factor.service';

/** "15m", "7d", "3600s" → milliseconds (the JWT_*_TTL settings). */
export function durationToMs(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) return Number(value) * 1000;
  const unit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return Number(match[1]) * unit;
}

const newRefreshId = () => randomBytes(32).toString('base64url');

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger('AuthenticationService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: AuthSessionRepository,
    private readonly multiFactor: MultiFactorService,
  ) {}

  /** DESC #4/#5 — verify credentials, enforce lockout, issue tokens, audit. */
  async login(dto: LoginDto, ipAddress?: string) {
    const genericError = new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      messageEn: 'Email or password is incorrect.',
      messageAr: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    });

    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !user.isActive) {
      // Same response whether the user exists or not (no account enumeration).
      throw genericError;
    }

    // Account lockout window (DESC #5).
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        messageEn: `This account is locked. Try again in ${minutes} minutes.`,
        messageAr: `هذا الحساب مقفل. حاول مرة أخرى بعد ${minutes} دقيقة.`,
        lockedMinutes: minutes,
      });
    }

    const passwordValid = await verify(user.passwordHash, dto.password).catch(() => false);
    if (!passwordValid) {
      await this.registerFailedAttempt(user, ipAddress);
      throw genericError;
    }

    // DESC #7: with two-step sign-in on, a correct password only earns a
    // short-lived challenge. Failed counters are left alone until the code is
    // right too, so guessing codes still leads to lockout.
    if (this.multiFactor.isRequired() && this.multiFactor.isExemptServiceAccount(user.email, ipAddress)) {
      return this.completeSignIn(user, ipAddress, false, 'EXEMPT_SERVICE_ACCOUNT');
    }
    if (this.multiFactor.isRequired()) {
      const purpose = user.mfaEnabledAt ? 'verify' : 'enroll';
      await this.writeAudit(user.id, purpose === 'verify' ? 'LOGIN_MFA_CHALLENGE' : 'LOGIN_MFA_ENROLLMENT_REQUIRED', user.id, ipAddress);
      const mfaToken = await this.multiFactor.issueChallenge(user.id, purpose);
      return purpose === 'verify' ? { mfaRequired: true as const, mfaToken } : { mfaEnrollmentRequired: true as const, mfaToken };
    }

    return this.completeSignIn(user, ipAddress, false);
  }

  /** DESC #7 — second step: the authenticator code. Wrong codes count towards lockout. */
  async verifyMultiFactor(mfaToken: string, code: string, ipAddress?: string) {
    const userId = await this.multiFactor.readChallenge(mfaToken, 'verify');
    const user = await this.activeUnlockedUser(userId);
    if (!user.mfaSecret || !user.mfaEnabledAt) throw this.wrongCode();
    const step = this.multiFactor.acceptedStep(code, this.multiFactor.decryptSecret(user.mfaSecret), user.mfaLastUsedStep);
    if (step === null) {
      await this.registerFailedAttempt(user, ipAddress, 'MFA_FAILED');
      throw this.wrongCode();
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaLastUsedStep: step } });
    return this.completeSignIn(user, ipAddress, true);
  }

  /** DESC #7 — enrolment, step 1: a fresh secret and its QR code (kept pending until confirmed). */
  async startMultiFactorEnrollment(mfaToken: string) {
    const userId = await this.multiFactor.readChallenge(mfaToken, 'enroll');
    const user = await this.activeUnlockedUser(userId);
    const enrollment = await this.multiFactor.createEnrollment(user.email);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: this.multiFactor.encryptSecret(enrollment.secret), mfaEnabledAt: null, mfaLastUsedStep: null },
    });
    return { otpauthUrl: enrollment.otpauthUrl, qrDataUrl: enrollment.qrDataUrl, manualKey: enrollment.manualKey };
  }

  /** DESC #7 — enrolment, step 2: the first code proves the app is set up; then sign in. */
  async confirmMultiFactorEnrollment(mfaToken: string, code: string, ipAddress?: string) {
    const userId = await this.multiFactor.readChallenge(mfaToken, 'enroll');
    const user = await this.activeUnlockedUser(userId);
    if (!user.mfaSecret) throw this.wrongCode();
    const step = this.multiFactor.acceptedStep(code, this.multiFactor.decryptSecret(user.mfaSecret), null);
    if (step === null) {
      await this.registerFailedAttempt(user, ipAddress, 'MFA_FAILED');
      throw this.wrongCode();
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaEnabledAt: new Date(), mfaLastUsedStep: step } });
    await this.writeAudit(user.id, 'MFA_ENROLLED', user.id, ipAddress);
    return this.completeSignIn(user, ipAddress, true);
  }

  /** Reset counters, stamp the login, audit it, open the session. */
  private async completeSignIn(user: User, ipAddress: string | undefined, usedMultiFactor: boolean, exemption?: 'EXEMPT_SERVICE_ACCOUNT') {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const secondFactor = usedMultiFactor ? 'TOTP' : exemption;
    await this.writeAudit(user.id, 'LOGIN_SUCCESS', user.id, ipAddress, secondFactor ? { secondFactor } : undefined);
    return this.startSession(user);
  }

  private async activeUnlockedUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw this.wrongCode();
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        messageEn: `This account is locked. Try again in ${minutes} minutes.`,
        messageAr: `هذا الحساب مقفل. حاول مرة أخرى بعد ${minutes} دقيقة.`,
        lockedMinutes: minutes,
      });
    }
    return user;
  }

  private wrongCode() {
    return new UnauthorizedException({
      code: 'MFA_CODE_INVALID',
      messageEn: 'That code is not right. Enter the 6-digit code currently shown in your authenticator app.',
      messageAr: 'هذا الرمز غير صحيح. أدخل الرمز المكوّن من 6 أرقام الظاهر الآن في تطبيق المصادقة.',
    });
  }

  /**
   * DESC #4 — exchange a refresh token for a new token pair. The refresh token
   * rotates: each one works once. Presenting one that was already used means
   * it was copied, so the whole session is ended (reuse detection).
   */
  async refresh(refreshToken: string, ipAddress?: string) {
    const sessionExpired = new UnauthorizedException({
      code: 'INVALID_REFRESH_TOKEN',
      messageEn: 'Your session has expired. Please sign in again.',
      messageAr: 'انتهت جلستك. الرجاء تسجيل الدخول مرة أخرى.',
    });
    let payload: { sub: string; sid?: string; rid?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw sessionExpired;
    }
    // Tokens from before sessions existed carry no session id: sign in again.
    if (!payload.sid || !payload.rid) throw sessionExpired;

    const session = await this.sessions.findById(payload.sid);
    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) {
      throw sessionExpired;
    }
    if (hashRefreshId(payload.rid) !== session.refreshTokenHash) {
      await this.sessions.revoke(session.id, 'REFRESH_REUSE');
      await this.writeAudit(payload.sub, 'SESSION_REFRESH_REUSE', payload.sub, ipAddress, { sessionId: session.id });
      this.logger.warn(`Refresh token reused; session ${session.id} ended for user ${payload.sub}`);
      throw sessionExpired;
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      await this.sessions.revoke(session.id, 'USER_DEACTIVATED');
      throw sessionExpired;
    }
    const refreshId = newRefreshId();
    await this.sessions.rotate(session.id, refreshId);
    const tokens = await this.issueTokens(user, session.id, refreshId);
    return { ...tokens, user: this.publicUser(user) };
  }

  /** DESC #4 — sign-out ends the session on the server, not only in the browser. */
  async logout(userId: string, sessionId: string | undefined, ipAddress?: string) {
    if (sessionId) await this.sessions.revoke(sessionId, 'SIGN_OUT');
    await this.writeAudit(userId, 'LOGOUT', userId, ipAddress, sessionId ? { sessionId } : undefined);
    return { success: true };
  }

  /** Opens a server-side session and returns its first token pair. */
  private async startSession(user: User) {
    const refreshId = newRefreshId();
    const expiresAt = new Date(Date.now() + durationToMs(this.config.get<string>('JWT_REFRESH_TTL', '7d')));
    const session = await this.sessions.create(user.id, refreshId, expiresAt);
    const tokens = await this.issueTokens(user, session.id, refreshId);
    return { ...tokens, user: this.publicUser(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', messageEn: 'Not found.', messageAr: 'غير موجود.' });
    }
    return this.publicUser(user);
  }

  // ---- helpers ----

  private async registerFailedAttempt(user: User, ipAddress?: string, failureAction = 'LOGIN_FAILED'): Promise<void> {
    const maxAttempts = Number(this.config.get('ACCOUNT_LOCKOUT_ATTEMPTS', 5));
    const lockMinutes = Number(this.config.get('ACCOUNT_LOCKOUT_MINUTES', 15));
    const nextCount = user.failedLoginCount + 1;

    if (nextCount >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockMinutes * 60000);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: nextCount, lockedUntil },
      });
      await this.writeAudit(user.id, 'ACCOUNT_LOCKED', user.id, ipAddress);
      this.logger.warn(`Account locked after ${nextCount} failed attempts: user ${user.id}`);
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: nextCount },
      });
      await this.writeAudit(user.id, failureAction, user.id, ipAddress);
    }
  }

  private async issueTokens(user: User, sessionId: string, refreshId: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, sid: sessionId },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: Math.floor(durationToMs(this.config.get<string>('JWT_ACCESS_TTL', '15m')) / 1000),
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: 'refresh', sid: sessionId, rid: refreshId },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: Math.floor(durationToMs(this.config.get<string>('JWT_REFRESH_TTL', '7d')) / 1000),
      },
    );
    return { accessToken, refreshToken };
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      preferredTheme: user.preferredTheme,
    };
  }

  /** DESC #9/#15 — audit every auth event; store the user id, never the password. */
  private async writeAudit(actorId: string | null, action: string, entityId: string, ipAddress?: string, after?: Record<string, string>) {
    try {
      await this.prisma.auditLog.create({
        data: { actorId, action, entityType: 'User', entityId, ipAddress: ipAddress ?? null, after },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for ${action}`);
    }
  }
}
