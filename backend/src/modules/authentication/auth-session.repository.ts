import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';

export type SessionEndReason =
  | 'SIGN_OUT'
  | 'REFRESH_REUSE'
  | 'USER_DEACTIVATED'
  | 'PASSWORD_CHANGED'
  | 'ADMIN_ENDED'
  | 'MFA_RESET';

/** Only a hash of the refresh token's random id is stored; a database read never yields a usable token. */
export const hashRefreshId = (refreshId: string): string => createHash('sha256').update(refreshId).digest('hex');

/**
 * DESC control 4 — server-side session store (CLAUDE.md §11.1).
 *
 * The spec names a Redis denylist; this deployment runs on one server with no
 * Redis, so sessions live in PostgreSQL behind this one class. Swapping to
 * Redis means re-implementing these methods only — callers do not change.
 *
 * Every authenticated request asks `isActive`. The answer is cached for a few
 * seconds so five users do not turn into a query per request; revoking clears
 * the cache entry at once, so a revoked session stops working immediately on
 * this instance and within SESSION_CHECK_CACHE_SECONDS anywhere else.
 */
@Injectable()
export class AuthSessionRepository {
  private readonly activeCache = new Map<string, { isActive: boolean; checkedAt: number }>();
  private readonly cacheMs: number;

  constructor(private readonly prisma: PrismaService, config: ConfigService) {
    this.cacheMs = Number(config.get('SESSION_CHECK_CACHE_SECONDS', 10)) * 1000;
  }

  create(userId: string, refreshId: string, expiresAt: Date) {
    return this.prisma.authSession.create({
      data: { userId, refreshTokenHash: hashRefreshId(refreshId), expiresAt },
    });
  }

  findById(sessionId: string) {
    return this.prisma.authSession.findUnique({ where: { id: sessionId } });
  }

  /** Refresh-token rotation: the previous refresh token stops being accepted. */
  rotate(sessionId: string, newRefreshId: string) {
    return this.prisma.authSession.update({
      where: { id: sessionId },
      data: { refreshTokenHash: hashRefreshId(newRefreshId), lastUsedAt: new Date() },
    });
  }

  async revoke(sessionId: string, reason: SessionEndReason): Promise<boolean> {
    const { count } = await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    this.activeCache.delete(sessionId);
    return count > 0;
  }

  /** Ends every open session a user has — deactivation, password change, an admin's request. */
  async revokeAllForUser(userId: string, reason: SessionEndReason, exceptSessionId?: string): Promise<number> {
    const open = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      select: { id: true },
    });
    if (open.length === 0) return 0;
    const { count } = await this.prisma.authSession.updateMany({
      where: { id: { in: open.map((s) => s.id) }, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    open.forEach((s) => this.activeCache.delete(s.id));
    return count;
  }

  async isActive(sessionId: string): Promise<boolean> {
    const cached = this.activeCache.get(sessionId);
    if (cached && Date.now() - cached.checkedAt < this.cacheMs) return cached.isActive;
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, expiresAt: true },
    });
    const isActive = Boolean(session && !session.revokedAt && session.expiresAt > new Date());
    this.activeCache.set(sessionId, { isActive, checkedAt: Date.now() });
    return isActive;
  }

  /** Open session counts per user, for the Users screen. */
  async openCountsByUser(): Promise<Map<string, number>> {
    const rows = await this.prisma.authSession.groupBy({
      by: ['userId'],
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.userId, r._count._all]));
  }
}
