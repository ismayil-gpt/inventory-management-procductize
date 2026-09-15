import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, StockMovement } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MovementDto } from './dto/movement.schema';

type Tx = Prisma.TransactionClient;

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 5000;

interface MovementFilters {
  type?: string;
  productId?: string;
  locationId?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a movement. Idempotent on clientId (safe offline-queue retry), atomic,
   * audited, and never allows stock to go negative (§12 rules 1, 3, 8).
   */
  async create(dto: MovementDto, userId: string, ipAddress?: string) {
    // Fast path: the same scan was already accepted (retry) — return it, no re-apply.
    const existing = await this.prisma.stockMovement.findUnique({ where: { clientId: dto.clientId } });
    if (existing) return { movement: await this.enrichOne(existing), idempotent: true };

    this.validateShape(dto);

    const movement = await this.prisma.$transaction(async (tx) => {
      // Re-check inside the transaction to close the retry race.
      const dup = await tx.stockMovement.findUnique({ where: { clientId: dto.clientId } });
      if (dup) return dup;

      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', messageEn: 'Product not found.', messageAr: 'المنتج غير موجود.' });

      const before: Record<string, number> = {};
      const after: Record<string, number> = {};

      const apply = async (nodeId: string, delta: number) => {
        await this.assertStockLocation(tx, nodeId);
        const position = await tx.stockPosition.findUnique({ where: { productId_locationNodeId: { productId: dto.productId, locationNodeId: nodeId } } });
        const current = position?.quantity ?? 0;
        const next = current + delta;
        if (next < 0) {
          throw new BadRequestException({
            code: 'STOCK_NEGATIVE',
            messageEn: 'Stock cannot go below zero at this location.',
            messageAr: 'لا يمكن أن يقل المخزون عن صفر في هذا الموقع.',
          });
        }
        before[nodeId] = current;
        after[nodeId] = next;
        await tx.stockPosition.upsert({
          where: { productId_locationNodeId: { productId: dto.productId, locationNodeId: nodeId } },
          create: { productId: dto.productId, locationNodeId: nodeId, quantity: next },
          update: { quantity: next },
        });
      };

      switch (dto.type) {
        case 'GOODS_IN':
          await apply(dto.toLocationNodeId!, dto.quantity);
          break;
        case 'GOODS_OUT':
          await apply(dto.fromLocationNodeId!, -dto.quantity);
          break;
        case 'TRANSFER':
          await apply(dto.fromLocationNodeId!, -dto.quantity);
          await apply(dto.toLocationNodeId!, dto.quantity);
          break;
        case 'ADJUSTMENT':
          await apply(dto.toLocationNodeId!, dto.quantity);
          break;
      }

      const created = await tx.stockMovement.create({
        data: {
          clientId: dto.clientId,
          type: dto.type,
          productId: dto.productId,
          fromLocationNodeId: dto.fromLocationNodeId ?? null,
          toLocationNodeId: dto.toLocationNodeId ?? null,
          quantity: dto.quantity,
          reason: dto.reason?.trim() || null,
          userId,
        },
      });

      // Same-transaction audit record (§12 rule 8, DESC #9).
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: `STOCK_${dto.type}`,
          entityType: 'StockMovement',
          entityId: created.id,
          before,
          after,
          ipAddress: ipAddress ?? null,
        },
      });

      return created;
    });

    return { movement: await this.enrichOne(movement), idempotent: false };
  }

  private validateShape(dto: MovementDto): void {
    const bad = (messageEn: string, messageAr: string) =>
      new BadRequestException({ code: 'INVALID_MOVEMENT', messageEn, messageAr });

    if (dto.type === 'ADJUSTMENT') {
      if (!dto.toLocationNodeId) throw bad('An adjustment needs a location.', 'يحتاج التعديل إلى موقع.');
      if (dto.quantity === 0) throw bad('The adjustment changes nothing.', 'التعديل لا يغيّر شيئًا.');
      if (!dto.reason || dto.reason.trim().length < 10) {
        throw new BadRequestException({
          code: 'ADJUSTMENT_REASON_REQUIRED',
          messageEn: 'Give a reason for this adjustment (at least 10 characters).',
          messageAr: 'أدخل سبب هذا التعديل (10 أحرف على الأقل).',
        });
      }
      return;
    }

    if (dto.quantity <= 0) throw bad('Quantity must be greater than zero.', 'يجب أن تكون الكمية أكبر من صفر.');
    if (dto.type === 'GOODS_IN' && !dto.toLocationNodeId) throw bad('Goods-in needs a destination location.', 'يحتاج الإدخال إلى موقع وجهة.');
    if (dto.type === 'GOODS_OUT' && !dto.fromLocationNodeId) throw bad('Goods-out needs a source location.', 'يحتاج الإخراج إلى موقع مصدر.');
    if (dto.type === 'TRANSFER') {
      if (!dto.fromLocationNodeId || !dto.toLocationNodeId) throw bad('A transfer needs both a source and a destination.', 'يحتاج النقل إلى مصدر ووجهة.');
      if (dto.fromLocationNodeId === dto.toLocationNodeId) throw bad('Source and destination must differ.', 'يجب أن يختلف المصدر عن الوجهة.');
    }
  }

  private async assertStockLocation(tx: Tx, nodeId: string): Promise<void> {
    const node = await tx.locationNode.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundException({ code: 'LOCATION_NOT_FOUND', messageEn: 'Location not found.', messageAr: 'الموقع غير موجود.' });
    const type = await tx.locationType.findUnique({ where: { id: node.locationTypeId } });
    if (!type?.canHoldStock) {
      throw new BadRequestException({ code: 'LOCATION_NOT_STOCK', messageEn: 'This location cannot hold stock.', messageAr: 'لا يمكن لهذا الموقع الاحتفاظ بالمخزون.' });
    }
  }

  async list(filters: MovementFilters) {
    const where: Prisma.StockMovementWhereInput = {};
    if (filters.type) where.type = filters.type as Prisma.StockMovementWhereInput['type'];
    if (filters.productId) where.productId = filters.productId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.locationId) where.OR = [{ fromLocationNodeId: filters.locationId }, { toLocationNodeId: filters.locationId }];
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }
    const take = Math.min(Math.max(filters.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const movements = await this.prisma.stockMovement.findMany({ where, orderBy: { createdAt: 'desc' }, take });
    return this.enrich(movements);
  }

  private async enrichOne(movement: StockMovement) {
    return (await this.enrich([movement]))[0];
  }

  private async enrich(movements: StockMovement[]) {
    if (movements.length === 0) return [];
    const productIds = [...new Set(movements.map((m) => m.productId))];
    const nodeIds = [...new Set(movements.flatMap((m) => [m.fromLocationNodeId, m.toLocationNodeId]).filter((v): v is string => Boolean(v)))];
    const userIds = [...new Set(movements.map((m) => m.userId))];

    const [products, nodes, users] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, sku: true, nameEn: true, nameAr: true } }),
      this.prisma.locationNode.findMany({ where: { id: { in: nodeIds } }, select: { id: true, designator: true } }),
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } }),
    ]);
    const productById = new Map(products.map((p) => [p.id, p]));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const userById = new Map(users.map((u) => [u.id, u]));

    return movements.map((m) => ({
      id: m.id,
      clientId: m.clientId,
      type: m.type,
      productId: m.productId,
      sku: productById.get(m.productId)?.sku ?? '—',
      nameEn: productById.get(m.productId)?.nameEn ?? '—',
      nameAr: productById.get(m.productId)?.nameAr ?? '—',
      fromDesignator: m.fromLocationNodeId ? nodeById.get(m.fromLocationNodeId)?.designator ?? null : null,
      toDesignator: m.toLocationNodeId ? nodeById.get(m.toLocationNodeId)?.designator ?? null : null,
      quantity: m.quantity,
      reason: m.reason,
      userName: userById.get(m.userId)?.displayName ?? '—',
      createdAt: m.createdAt,
    }));
  }
}
