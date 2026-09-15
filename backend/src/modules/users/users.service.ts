import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.schema';

const PUBLIC_SELECT = {
  id: true, email: true, displayName: true, role: true, isActive: true, lastLoginAt: true, preferredLanguage: true, createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** ADMIN-only user listing (§7 GET /users). Never returns password hashes. */
  async list() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: PUBLIC_SELECT });
  }

  async create(dto: CreateUserDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException({ code: 'EMAIL_TAKEN', messageEn: 'That email is already in use.', messageAr: 'هذا البريد الإلكتروني مستخدم بالفعل.' });

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          displayName: dto.displayName,
          role: dto.role,
          passwordHash: await hash(dto.password),
          preferredLanguage: dto.preferredLanguage,
        },
        select: PUBLIC_SELECT,
      });
      // Never log the password — user id + role only (DESC #15).
      await tx.auditLog.create({ data: { actorId, action: 'USER_CREATE', entityType: 'User', entityId: created.id, after: { email: created.email, role: created.role } } });
      return created;
    });
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: 'USER_NOT_FOUND', messageEn: 'User not found.', messageAr: 'المستخدم غير موجود.' });
    // Guard against locking yourself out.
    if (id === actorId && dto.isActive === false) {
      throw new BadRequestException({ code: 'CANNOT_DEACTIVATE_SELF', messageEn: 'You cannot deactivate your own account.', messageAr: 'لا يمكنك إلغاء تفعيل حسابك.' });
    }

    const data: Record<string, unknown> = {
      displayName: dto.displayName,
      role: dto.role,
      isActive: dto.isActive,
      preferredLanguage: dto.preferredLanguage,
    };
    if (dto.password) {
      data.passwordHash = await hash(dto.password);
      data.failedLoginCount = 0;
      data.lockedUntil = null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data, select: PUBLIC_SELECT });
      await tx.auditLog.create({
        data: {
          actorId, action: 'USER_UPDATE', entityType: 'User', entityId: id,
          before: { role: before.role, isActive: before.isActive },
          after: { role: u.role, isActive: u.isActive, passwordReset: Boolean(dto.password) },
        },
      });
      return u;
    });
    return updated;
  }

  /**
   * Hard-delete a user, but ONLY when they have no recorded activity. A user who
   * has moved stock, decided a recommendation, run a cycle count, or produced any
   * audit entry must be kept — deactivate them instead — so the audit trail's
   * actor never dangles (there are no FKs; this check IS the integrity guard).
   */
  async remove(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', messageEn: 'User not found.', messageAr: 'المستخدم غير موجود.' });
    if (id === actorId) throw new BadRequestException({ code: 'CANNOT_DELETE_SELF', messageEn: 'You cannot delete your own account.', messageAr: 'لا يمكنك حذف حسابك.' });

    const [movements, decisions, cycleCounts, auditActs] = await Promise.all([
      this.prisma.stockMovement.count({ where: { userId: id } }),
      this.prisma.recommendation.count({ where: { decidedByUserId: id } }),
      this.prisma.cycleCount.count({ where: { createdByUserId: id } }),
      this.prisma.auditLog.count({ where: { actorId: id } }),
    ]);
    if (movements + decisions + cycleCounts + auditActs > 0) {
      throw new ConflictException({ code: 'USER_HAS_HISTORY', messageEn: 'This user has recorded activity and cannot be deleted. Deactivate them instead to preserve the audit trail.', messageAr: 'لدى هذا المستخدم نشاط مسجّل ولا يمكن حذفه. قم بإلغاء تفعيله بدلاً من ذلك للحفاظ على سجل التدقيق.' });
    }

    // Never delete the last administrator — it would lock everyone out of admin.
    if (user.role === 'ADMIN') {
      const otherAdmins = await this.prisma.user.count({ where: { role: 'ADMIN', id: { not: id } } });
      if (otherAdmins === 0) throw new ConflictException({ code: 'LAST_ADMIN', messageEn: 'You cannot delete the last administrator.', messageAr: 'لا يمكنك حذف المسؤول الأخير.' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id } });
      await tx.auditLog.create({ data: { actorId, action: 'USER_DELETE', entityType: 'User', entityId: id, before: { email: user.email, role: user.role, displayName: user.displayName } } });
    });
    return { deleted: true };
  }
}
