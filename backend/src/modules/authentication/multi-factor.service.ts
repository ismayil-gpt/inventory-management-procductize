import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { BlockList, isIPv4, isIPv6 } from 'node:net';

/**
 * DESC control 7 — two-step sign-in with an authenticator app (TOTP, RFC 6238).
 *
 * Built now and switched off by MFA_ENABLED=false until certification (§11.1),
 * so turning it on is configuration, not a code change.
 *
 * - The TOTP secret is stored encrypted (AES-256-GCM, key from
 *   MFA_ENCRYPTION_KEY); a database copy alone cannot generate codes.
 * - Codes are accepted one 30-second step either side for clock drift, and each
 *   step only once, so a code read over someone's shoulder cannot be replayed.
 * - Between the password and the code the client holds a short-lived challenge
 *   token, never a session.
 * - The QR code is drawn on the server; nothing is sent to an outside service.
 */
export type ChallengePurpose = 'verify' | 'enroll';

const TOTP_STEP_SECONDS = 30;
const CHALLENGE_TTL = '5m';
const CHALLENGE_AUDIENCE = 'mizan-mfa';
const ENCRYPTION_VERSION = 'v1';

authenticator.options = { step: TOTP_STEP_SECONDS, window: 1, digits: 6 };

@Injectable()
export class MultiFactorService {
  constructor(private readonly config: ConfigService, private readonly jwt: JwtService) {}

  isRequired(): boolean {
    return String(this.config.get('MFA_ENABLED', 'false')).toLowerCase() === 'true';
  }

  /**
   * Machine accounts (the AI service's daily review) cannot type a code. They
   * may skip the second step only if listed in MFA_EXEMPT_ACCOUNTS **and**
   * signing in from MFA_EXEMPT_NETWORKS (default: this server only). A stolen
   * service password used from anywhere else still meets the code challenge.
   */
  isExemptServiceAccount(email: string, ipAddress: string | undefined): boolean {
    const accounts = String(this.config.get('MFA_EXEMPT_ACCOUNTS', ''))
      .split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
    if (!accounts.includes(email.toLowerCase()) || !ipAddress) return false;
    const ip = ipAddress.replace(/^::ffff:/, '');
    const networks = new BlockList();
    for (const entry of String(this.config.get('MFA_EXEMPT_NETWORKS', '127.0.0.1/32,::1/128')).split(',')) {
      const [address, prefix] = entry.trim().split('/');
      if (!address) continue;
      const family = isIPv6(address) ? 'ipv6' : 'ipv4';
      networks.addSubnet(address, Number(prefix ?? (family === 'ipv6' ? 128 : 32)), family);
    }
    if (isIPv4(ip)) return networks.check(ip, 'ipv4');
    if (isIPv6(ip)) return networks.check(ip, 'ipv6');
    return false;
  }

  issueChallenge(userId: string, purpose: ChallengePurpose): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, purpose },
      { secret: this.config.get<string>('JWT_SECRET'), expiresIn: CHALLENGE_TTL, audience: CHALLENGE_AUDIENCE },
    );
  }

  async readChallenge(token: string, purpose: ChallengePurpose): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; purpose: ChallengePurpose }>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
        audience: CHALLENGE_AUDIENCE,
      });
      if (payload.purpose !== purpose) throw new Error('wrong purpose');
      return payload.sub;
    } catch {
      throw new UnauthorizedException({
        code: 'MFA_CHALLENGE_EXPIRED',
        messageEn: 'The sign-in step timed out. Enter your email and password again.',
        messageAr: 'انتهت مهلة خطوة تسجيل الدخول. أدخل بريدك الإلكتروني وكلمة المرور مجددًا.',
      });
    }
  }

  /** A new secret plus what the person needs to add it to their authenticator app. */
  async createEnrollment(accountLabel: string): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string; manualKey: string }> {
    const secret = authenticator.generateSecret(20);
    const issuer = this.config.get<string>('MFA_ISSUER', 'Mizan');
    const otpauthUrl = authenticator.keyuri(accountLabel, issuer, secret);
    const qrDataUrl = await toDataURL(otpauthUrl, { margin: 1, width: 220 });
    const manualKey = secret.match(/.{1,4}/g)?.join(' ') ?? secret;
    return { secret, otpauthUrl, qrDataUrl, manualKey };
  }

  /**
   * Returns the accepted 30-second step, or null when the code is wrong or that
   * step was already used (lastUsedStep).
   */
  acceptedStep(code: string, secret: string, lastUsedStep: number | null): number | null {
    if (!/^\d{6}$/.test(code)) return null;
    const delta = authenticator.checkDelta(code, secret);
    if (delta === null) return null;
    const step = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS) + delta;
    if (lastUsedStep !== null && step <= lastUsedStep) return null;
    return step;
  }

  encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return `${ENCRYPTION_VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')}`;
  }

  decryptSecret(stored: string): string {
    const [version, body] = stored.split(':');
    if (version !== ENCRYPTION_VERSION || !body) throw new InternalServerErrorException({ code: 'MFA_SECRET_UNREADABLE', messageEn: 'Two-step sign-in data is unreadable.', messageAr: 'بيانات التحقق بخطوتين غير قابلة للقراءة.' });
    const raw = Buffer.from(body, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  }

  private encryptionKey(): Buffer {
    const key = Buffer.from(this.config.get<string>('MFA_ENCRYPTION_KEY', ''), 'base64');
    if (key.length !== 32) {
      throw new InternalServerErrorException({
        code: 'MFA_NOT_CONFIGURED',
        messageEn: 'Two-step sign-in is not configured on the server. Contact your administrator.',
        messageAr: 'التحقق بخطوتين غير مهيأ على الخادم. تواصل مع المسؤول.',
      });
    }
    return key;
  }
}
