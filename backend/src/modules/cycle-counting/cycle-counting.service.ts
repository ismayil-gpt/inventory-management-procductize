import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { StockMovementsService } from '../stock-movements/stock-movements.service';

@Injectable()
export class CycleCountingService {
  constructor(private readonly prisma: PrismaService, private readonly movements: StockMovementsService) {}

  private async organizationId(): Promise<string> {
    const org = await this.prisma.organization.findFirst({ where: { isActive: true } });
    if (!org) throw new NotFoundException({ code: 'NO_ORGANIZATION', messageEn: 'No organization configured.', messageAr: 'لا توجد مؤسسة مهيأة.' });
    return org.id;
  }

  async create(note: string | null | undefined, userId: string) {
    const organizationId = await this.organizationId();
    return this.prisma.cycleCount.create({ data: { organizationId, note: note ?? null, createdByUserId: userId, status: 'OPEN' } });
  }

  async list() {
    const sessions = await this.prisma.cycleCount.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    const counts = await this.prisma.cycleCountLine.groupBy({ by: ['cycleCountId'], _count: { _all: true } });
    const countBy = new Map(counts.map((c) => [c.cycleCountId, c._count._all]));
    return sessions.map((s) => ({ id: s.id, status: s.status, note: s.note, lineCount: countBy.get(s.id) ?? 0, createdAt: s.createdAt, closedAt: s.closedAt }));
  }

  /** Record a counted quantity. Snapshots the on-record stock; does NOT mutate it (§12 r4). */
  async scan(cycleCountId: string, dto: { productId: string; locationNodeId: string; countedQty: number }) {
    const session = await this.mustBeOpen(cycleCountId);
    const position = await this.prisma.stockPosition.findUnique({ where: { productId_locationNodeId: { productId: dto.productId, locationNodeId: dto.locationNodeId } } });
    const systemQty = position?.quantity ?? 0;
    await this.prisma.cycleCountLine.upsert({
      where: { cycleCountId_productId_locationNodeId: { cycleCountId: session.id, productId: dto.productId, locationNodeId: dto.locationNodeId } },
      create: { cycleCountId: session.id, productId: dto.productId, locationNodeId: dto.locationNodeId, countedQty: dto.countedQty, systemQty },
      update: { countedQty: dto.countedQty, systemQty },
    });
    return this.variance(session.id);
  }

  async get(cycleCountId: string) {
    await this.prisma.cycleCount.findUniqueOrThrow({ where: { id: cycleCountId } }).catch(() => {
      throw new NotFoundException({ code: 'CYCLE_COUNT_NOT_FOUND', messageEn: 'Cycle count not found.', messageAr: 'الجرد غير موجود.' });
    });
    return this.variance(cycleCountId);
  }

  /**
   * Close a session and return the variance report. When `apply` is true, each
   * non-zero variance becomes an audited ADJUSTMENT movement (§12 r4) via the
   * verified movements path (which enforces the never-negative rule).
   */
  async close(cycleCountId: string, apply: boolean, userId: string, ipAddress?: string) {
    const session = await this.mustBeOpen(cycleCountId);
    const report = await this.variance(cycleCountId);

    let applied = 0;
    if (apply) {
      for (const line of report.lines) {
        if (line.variance === 0) continue;
        await this.movements.create(
          {
            clientId: randomUUID(),
            type: 'ADJUSTMENT',
            productId: line.productId,
            toLocationNodeId: line.locationNodeId,
            quantity: line.variance, // signed delta -> new stock equals the count
            reason: `Cycle count ${cycleCountId.slice(0, 8)} adjustment`,
          },
          userId,
          ipAddress,
        );
        applied += 1;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cycleCount.update({ where: { id: session.id }, data: { status: 'CLOSED', closedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'CYCLE_COUNT_CLOSE', entityType: 'CycleCount', entityId: session.id, after: { applied, lines: report.lines.length } } });
    });

    return { ...report, status: 'CLOSED' as const, applied };
  }

  // ---- helpers ----

  private async mustBeOpen(id: string) {
    const session = await this.prisma.cycleCount.findUnique({ where: { id } });
    if (!session) throw new NotFoundException({ code: 'CYCLE_COUNT_NOT_FOUND', messageEn: 'Cycle count not found.', messageAr: 'الجرد غير موجود.' });
    if (session.status !== 'OPEN') throw new BadRequestException({ code: 'CYCLE_COUNT_CLOSED', messageEn: 'This cycle count is already closed.', messageAr: 'هذا الجرد مغلق بالفعل.' });
    return session;
  }

  /** Recompute the current variance (counted − current on-record stock). */
  private async variance(cycleCountId: string) {
    const session = await this.prisma.cycleCount.findUniqueOrThrow({ where: { id: cycleCountId } });
    const lines = await this.prisma.cycleCountLine.findMany({ where: { cycleCountId }, orderBy: { createdAt: 'asc' } });
    if (lines.length === 0) return { id: cycleCountId, status: session.status, note: session.note, lines: [] as VarianceLine[] };

    const productIds = [...new Set(lines.map((l) => l.productId))];
    const nodeIds = [...new Set(lines.map((l) => l.locationNodeId))];
    const [products, nodes, positions] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, sku: true, nameEn: true, nameAr: true } }),
      this.prisma.locationNode.findMany({ where: { id: { in: nodeIds } }, select: { id: true, designator: true } }),
      this.prisma.stockPosition.findMany({ where: { productId: { in: productIds }, locationNodeId: { in: nodeIds } } }),
    ]);
    const prod = new Map(products.map((p) => [p.id, p]));
    const des = new Map(nodes.map((n) => [n.id, n.designator]));
    const curr = new Map(positions.map((p) => [`${p.productId}:${p.locationNodeId}`, p.quantity]));

    const reportLines: VarianceLine[] = lines.map((l) => {
      const currentQty = curr.get(`${l.productId}:${l.locationNodeId}`) ?? 0;
      return {
        productId: l.productId,
        locationNodeId: l.locationNodeId,
        sku: prod.get(l.productId)?.sku ?? '—',
        nameEn: prod.get(l.productId)?.nameEn ?? '—',
        nameAr: prod.get(l.productId)?.nameAr ?? '—',
        designator: des.get(l.locationNodeId) ?? '—',
        currentQty,
        countedQty: l.countedQty,
        variance: l.countedQty - currentQty,
      };
    });
    return { id: cycleCountId, status: session.status, note: session.note, lines: reportLines };
  }
}

export interface VarianceLine {
  productId: string; locationNodeId: string; sku: string; nameEn: string; nameAr: string;
  designator: string; currentQty: number; countedQty: number; variance: number;
}
