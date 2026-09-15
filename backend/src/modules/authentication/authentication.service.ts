import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { verify } from '@node-rs/argon2';
import type { User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.schema';

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

    // Success — reset counters, stamp last login.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.writeAudit(user.id, 'LOGIN_SUCCESS', user.id, ipAddress);

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.publicUser(user) };
  }

  /** DESC #4 — exchange a valid refresh token for a fresh access token. */
  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        messageEn: 'Your session has expired. Please sign in again.',
        messageAr: 'انتهت جلستك. الرجاء تسجيل الدخول مرة أخرى.',
      });
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', messageEn: 'Session invalid.', messageAr: 'الجلسة غير صالحة.' });
    }
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.publicUser(user) };
  }

  async logout(userId: string, ipAddress?: string) {
    // NOTE: stateless JWT. Server-side revocation via a Redis denylist (DESC #4)
    // is a documented production upgrade; the client discards its tokens now.
    await this.writeAudit(userId, 'LOGOUT', userId, ipAddress);
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', messageEn: 'Not found.', messageAr: 'غير موجود.' });
    }
    return this.publicUser(user);
  }

  // ---- helpers ----

  private async registerFailedAttempt(user: User, ipAddress?: string): Promise<void> {
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
      await this.writeAudit(user.id, 'LOGIN_FAILED', user.id, ipAddress);
    }
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '7d'),
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
  private async writeAudit(actorId: string | null, action: string, entityId: string, ipAddress?: string) {
    try {
      await this.prisma.auditLog.create({
        data: { actorId, action, entityType: 'User', entityId, ipAddress: ipAddress ?? null },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for ${action}`);
    }
  }
}
