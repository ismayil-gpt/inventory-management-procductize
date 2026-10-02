import type { PrismaService } from '../../database/prisma.service';

// Test-only stand-in for the few Prisma calls the authentication code makes —
// users, audit rows and sessions held in memory — so session and two-step
// sign-in rules can be tested fast without a database.
type SessionRow = { id: string; userId: string; refreshTokenHash: string; createdAt: Date; lastUsedAt: Date; expiresAt: Date; revokedAt: Date | null; revokedReason: string | null };

export function fakePrisma(user: Record<string, unknown>) {
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
  const prisma: Record<string, unknown> = {
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
  // Array form only, as used by AuthenticationService: the calls above run eagerly here.
  prisma.$transaction = async (operations: Array<Promise<unknown>>) => Promise.all(operations);
  return { prisma: prisma as unknown as PrismaService, sessions, audit };
}
