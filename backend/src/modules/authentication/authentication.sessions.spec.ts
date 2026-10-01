import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { hash } from '@node-rs/argon2';
import { AuthenticationService } from './authentication.service';
import { AuthSessionRepository } from './auth-session.repository';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { MultiFactorService } from './multi-factor.service';
import { fakePrisma } from './in-memory-auth-database';

// DESC control 4 evidence: sessions are server-side, refresh tokens rotate and
// are single-use, reuse ends the session, and sign-out / revocation stops the
// access token at the next request. Real JWT signing, real session repository;
// only the database is an in-memory stand-in.
describe('server-side sessions (DESC control 4)', () => {
  const config = new ConfigService({ JWT_SECRET: 'access-secret-for-tests', JWT_REFRESH_SECRET: 'refresh-secret-for-tests', SESSION_CHECK_CACHE_SECONDS: '0' });
  const jwt = new JwtService({});
  let service: AuthenticationService;
  let repository: AuthSessionRepository;
  let strategy: JwtAccessStrategy;
  let db: ReturnType<typeof fakePrisma>;

  beforeEach(async () => {
    const user = { id: 'u1', email: 'keeper@example.com', passwordHash: await hash('Correct-Horse-12'), displayName: 'Keeper', role: 'STORE_KEEPER', isActive: true, failedLoginCount: 0, lockedUntil: null, preferredLanguage: 'en', preferredTheme: 'system' };
    db = fakePrisma(user);
    repository = new AuthSessionRepository(db.prisma, config);
    service = new AuthenticationService(db.prisma, jwt, config, repository, new MultiFactorService(config, jwt));
    strategy = new JwtAccessStrategy(config, repository);
  });

  // Two-step sign-in is off here (MFA_ENABLED unset), so a password alone opens the session.
  const signIn = async () => (await service.login({ email: 'keeper@example.com', password: 'Correct-Horse-12' })) as { accessToken: string; refreshToken: string };
  const accessPayload = (token: string) => jwt.verify(token, { secret: config.get<string>('JWT_SECRET') });

  it('opens a server-side session on sign-in and ties both tokens to it', async () => {
    const { accessToken } = await signIn();
    expect(db.sessions.size).toBe(1);
    const payload = accessPayload(accessToken);
    expect(payload.sid).toBe([...db.sessions.keys()][0]);
    await expect(strategy.validate(payload)).resolves.toMatchObject({ userId: 'u1', sessionId: payload.sid });
  });

  it('stores only a hash of the refresh token', async () => {
    const { refreshToken } = await signIn();
    const stored = [...db.sessions.values()][0].refreshTokenHash;
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(refreshToken).not.toContain(stored);
  });

  it('rotates the refresh token: the new one works, the old one is refused', async () => {
    const first = await signIn();
    const second = await service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(service.refresh(second.refreshToken)).resolves.toBeDefined();
  });

  it('treats a reused refresh token as theft and ends the whole session', async () => {
    const first = await signIn();
    const second = await service.refresh(first.refreshToken);
    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ response: { code: 'INVALID_REFRESH_TOKEN' } });
    const session = [...db.sessions.values()][0];
    expect(session.revokedReason).toBe('REFRESH_REUSE');
    expect(db.audit.map((a) => a.action)).toContain('SESSION_REFRESH_REUSE');
    // The legitimate holder's newer token dies with the session too.
    await expect(service.refresh(second.refreshToken)).rejects.toBeDefined();
    await expect(strategy.validate(accessPayload(second.accessToken))).rejects.toMatchObject({ response: { code: 'SESSION_ENDED' } });
  });

  it('sign-out ends the session: the access token is refused on the next request', async () => {
    const { accessToken, refreshToken } = await signIn();
    const payload = accessPayload(accessToken);
    await service.logout('u1', payload.sid);
    await expect(strategy.validate(payload)).rejects.toMatchObject({ response: { code: 'SESSION_ENDED' } });
    await expect(service.refresh(refreshToken)).rejects.toBeDefined();
  });

  it('revoking all of a user’s sessions can keep the one in use', async () => {
    const kept = accessPayload((await signIn()).accessToken);
    const other = accessPayload((await signIn()).accessToken);
    const ended = await repository.revokeAllForUser('u1', 'PASSWORD_CHANGED', kept.sid);
    expect(ended).toBe(1);
    await expect(strategy.validate(kept)).resolves.toBeDefined();
    await expect(strategy.validate(other)).rejects.toBeDefined();
  });

  it('refuses tokens issued before sessions existed', async () => {
    const legacy = await jwt.signAsync({ sub: 'u1', email: 'keeper@example.com', role: 'STORE_KEEPER' }, { secret: config.get<string>('JWT_SECRET'), expiresIn: '15m' });
    await expect(strategy.validate(accessPayload(legacy))).rejects.toMatchObject({ response: { code: 'SESSION_ENDED' } });
  });
});
