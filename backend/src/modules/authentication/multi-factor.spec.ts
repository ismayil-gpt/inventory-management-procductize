import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { hash } from '@node-rs/argon2';
import { authenticator } from 'otplib';
import { randomBytes } from 'node:crypto';
import { AuthenticationService } from './authentication.service';
import { AuthSessionRepository } from './auth-session.repository';
import { MultiFactorService } from './multi-factor.service';
import { fakePrisma } from './in-memory-auth-database';

// DESC control 7 evidence: with MFA_ENABLED=true a password alone never opens a
// session; enrolment needs a working code; codes are single-use; wrong codes
// lead to lockout; the stored secret is encrypted.
describe('two-step sign-in (DESC control 7)', () => {
  const config = new ConfigService({
    JWT_SECRET: 'access-secret-for-tests',
    JWT_REFRESH_SECRET: 'refresh-secret-for-tests',
    MFA_ENABLED: 'true',
    MFA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    SESSION_CHECK_CACHE_SECONDS: '0',
  });
  const jwt = new JwtService({});
  let service: AuthenticationService;
  let db: ReturnType<typeof fakePrisma>;
  let user: Record<string, unknown>;

  beforeEach(async () => {
    process.env.MFA_ENABLED = 'true';
    user = { id: 'u1', email: 'admin@example.com', passwordHash: await hash('Correct-Horse-12'), displayName: 'Admin', role: 'ADMIN', isActive: true, failedLoginCount: 0, lockedUntil: null, mfaSecret: null, mfaEnabledAt: null, mfaLastUsedStep: null, preferredLanguage: 'en', preferredTheme: 'system' };
    db = fakePrisma(user);
    service = new AuthenticationService(db.prisma, jwt, config, new AuthSessionRepository(db.prisma, config), new MultiFactorService(config, jwt));
  });
  afterEach(() => {
    delete process.env.MFA_ENABLED;
  });

  type SignInOutcome = { mfaToken: string; mfaRequired?: boolean; mfaEnrollmentRequired?: boolean; accessToken?: string };
  const password = async () => (await service.login({ email: 'admin@example.com', password: 'Correct-Horse-12' })) as unknown as SignInOutcome;

  async function enroll(): Promise<string> {
    const challenge = await password();
    const { manualKey } = await service.startMultiFactorEnrollment(challenge.mfaToken);
    const secret = manualKey.replace(/ /g, '');
    await service.confirmMultiFactorEnrollment(challenge.mfaToken, authenticator.generate(secret));
    return secret;
  }

  it('asks a person without two-step sign-in to enrol, and opens no session yet', async () => {
    const result = await password();
    expect(result.mfaEnrollmentRequired).toBe(true);
    expect(result.accessToken).toBeUndefined();
    expect(db.sessions.size).toBe(0);
  });

  it('gives a QR code drawn on the server and stores the secret encrypted', async () => {
    const challenge = await password();
    const enrollment = await service.startMultiFactorEnrollment(challenge.mfaToken);
    expect(enrollment.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const secret = enrollment.manualKey.replace(/ /g, '');
    expect(String(user.mfaSecret)).toMatch(/^v1:/);
    expect(String(user.mfaSecret)).not.toContain(secret);
  });

  it('finishes enrolment only with a working code, then signs in', async () => {
    const challenge = await password();
    const { manualKey } = await service.startMultiFactorEnrollment(challenge.mfaToken);
    await expect(service.confirmMultiFactorEnrollment(challenge.mfaToken, '000000')).rejects.toMatchObject({ response: { code: 'MFA_CODE_INVALID' } });
    const signedIn = await service.confirmMultiFactorEnrollment(challenge.mfaToken, authenticator.generate(manualKey.replace(/ /g, '')));
    expect(signedIn).toHaveProperty('accessToken');
    expect(user.mfaEnabledAt).toBeInstanceOf(Date);
    expect(db.audit.map((a) => a.action)).toContain('MFA_ENROLLED');
  });

  it('after enrolment a password earns only a challenge; the code completes sign-in', async () => {
    const secret = await enroll();
    user.mfaLastUsedStep = null; // a new 30-second window in real life
    const challenge = await password();
    expect(challenge.mfaRequired).toBe(true);
    await expect(service.verifyMultiFactor(challenge.mfaToken, authenticator.generate(secret))).resolves.toHaveProperty('accessToken');
  });

  it('accepts each code only once', async () => {
    const secret = await enroll();
    const code = authenticator.generate(secret);
    const challenge = await password();
    await expect(service.verifyMultiFactor(challenge.mfaToken, code)).rejects.toMatchObject({ response: { code: 'MFA_CODE_INVALID' } });
  });

  it('locks the account after repeated wrong codes', async () => {
    await enroll();
    const challenge = await password();
    for (let i = 0; i < 5; i += 1) {
      await service.verifyMultiFactor(challenge.mfaToken, '123456').catch(() => undefined);
    }
    expect(user.lockedUntil).toBeInstanceOf(Date);
    await expect(service.verifyMultiFactor(challenge.mfaToken, '123456')).rejects.toMatchObject({ response: { code: 'ACCOUNT_LOCKED' } });
    expect(db.audit.filter((a) => a.action === 'MFA_FAILED').length).toBeGreaterThan(0);
  });

  it('lets a listed service account skip the code only from this server', () => {
    const multiFactor = new MultiFactorService(new ConfigService({ MFA_EXEMPT_ACCOUNTS: 'ai-service@example.com' }), jwt);
    expect(multiFactor.isExemptServiceAccount('ai-service@example.com', '127.0.0.1')).toBe(true);
    expect(multiFactor.isExemptServiceAccount('ai-service@example.com', '::ffff:127.0.0.1')).toBe(true);
    expect(multiFactor.isExemptServiceAccount('ai-service@example.com', '10.20.4.31')).toBe(false);
    expect(multiFactor.isExemptServiceAccount('admin@example.com', '127.0.0.1')).toBe(false);
  });

  it('will not let an enrolment challenge stand in for a verification challenge', async () => {
    const challenge = await password();
    await expect(service.verifyMultiFactor(challenge.mfaToken, '123456')).rejects.toMatchObject({ response: { code: 'MFA_CHALLENGE_EXPIRED' } });
  });
});
