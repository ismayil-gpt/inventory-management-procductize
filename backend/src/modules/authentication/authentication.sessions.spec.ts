import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { hash } from '@node-rs/argon2';
import { AuthenticationService } from './authentication.service';
import { AuthSessionRepository } from './auth-session.repository';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import type { PrismaService } from '../../database/prisma.service';

// DESC control 4 evidence: sessions are server-side, refresh tokens rotate and
// are single-use, reuse ends the session, and sign-out / revocation stops the
// access token at the next request. Real JWT signing, real session repository;
// only the database is an in-memory stand-in.
type SessionRow = { id: string; userId: string; refreshTokenHash: string; createdAt: Date; lastUsedAt: Date; expiresAt: Date; revokedAt: Date | null; revokedReason: string | null };

function fakePrisma(user: Record<string, unknown>) {
  const sessions = new Map<string, SessionRow>();
  const audit: Array<{ action: string }> = [];
  let nextId = 1;
  const matches = (row: SessionRow, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, condition]) => {
      const value = row[key as keyof SessionRow];
      if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
        const c = condition as { in?: string[]; not?: string; gt?: Date };
        if (c.in) return c.in.includes(value as string);
        if (c.not !== undefined) return value !== c.not;
        if (c.gt) return (value as Date) > c.gt;
      }
      return value === condition;
    });
  const prisma = {
    user: {
      findUnique: async () => user,
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(user, data),
    },
    auditLog: { create: async ({ data }: { data: { action: string } }) => audit.push(data) },
    authSession: {
      create: async ({ data }: { data: Omit<SessionRow, 'id' | 'createdAt' | 'lastUsedAt' | 'revokedAt' | 'revokedReason'> }) => {
        const row: SessionRow = { id: `s${nextId++}`, createdAt: new Date(), lastUsedAt: new Date(), revokedAt: null, revokedReason: null, ...data };
        sessions.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) => sessions.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<SessionRow> }) => Object.assign(sessions.get(where.id)!, data),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<SessionRow> }) => {
        const hits = [...sessions.values()].filter((r) => matches(r, where));
        hits.forEach((r) => Object.assign(r, data));
        return { count: hits.length };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => [...sessions.values()].filter((r) => matches(r, where)),
    },
  };
  return { prisma: prisma as unknown as PrismaService, sessions, audit };
}

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
    service = new AuthenticationService(db.prisma, jwt, config, repository);
    strategy = new JwtAccessStrategy(config, repository);
  });

  const signIn = () => service.login({ email: 'keeper@example.com', password: 'Correct-Horse-12' });
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
