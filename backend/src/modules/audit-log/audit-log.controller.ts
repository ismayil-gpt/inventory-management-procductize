import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Role, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/roles.decorator';

// Read-only audit trail (§7, §11 #9-10). ADMIN only. Append-only at the DB level.
@ApiTags('audit-log')
@ApiBearerAuth()
@Controller('audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'View the audit trail with filters (ADMIN)' })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async list(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const where: Prisma.AuditLogWhereInput = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (actorId) where.actorId = actorId;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const rows = await this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 });
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((v): v is string => Boolean(v)))];
    const actors = await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, displayName: true } });
    const actorById = new Map(actors.map((a) => [a.id, a.displayName]));

    return rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      actorName: r.actorId ? actorById.get(r.actorId) ?? '—' : 'system',
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt,
    }));
  }
}
