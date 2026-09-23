import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Dashboard summary computed from real data. Stock state per product follows
 * §9.8: out (0), critical (<= minLevel), low (<= reorderPoint), else in stock.
 * (The schema uses scalar foreign keys with no relations, so totals are summed
 * in code rather than via nested aggregation.)
 *
 * Every figure here is a direct read or aggregate of real rows — none of it is
 * templated or estimated (§8.3, §18 "deterministic over generative").
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const since30 = daysAgo(30);
    const since14 = daysAgo(14);

    const [
      products,
      positions,
      shelfCount,
      storeRoomCount,
      supplierCount,
      trendMovements,
      movements30dCount,
      categories,
      recommendationCounts,
      recentMovements,
    ] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, reorderPoint: true, minLevel: true, categoryId: true },
      }),
      this.prisma.stockPosition.findMany({ select: { productId: true, quantity: true } }),
      this.prisma.locationNode.count({ where: { barcode: { not: null }, isActive: true } }),
      this.prisma.locationType.findMany({ where: { code: 'STORE_ROOM' }, select: { id: true } }),
      this.prisma.supplier.count({ where: { isActive: true } }),
      this.prisma.stockMovement.findMany({
        where: { createdAt: { gte: since14 }, type: { in: ['GOODS_IN', 'GOODS_OUT'] } },
        select: { type: true, quantity: true, createdAt: true },
      }),
      this.prisma.stockMovement.count({ where: { createdAt: { gte: since30 } } }),
      this.prisma.productCategory.findMany({ where: { isActive: true }, select: { id: true, parentId: true, nameEn: true, nameAr: true } }),
      this.prisma.recommendation.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.stockMovement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, type: true, quantity: true, createdAt: true, productId: true, fromLocationNodeId: true, toLocationNodeId: true, userId: true },
      }),
    ]);

    const qtyByProduct = new Map<string, number>();
    for (const p of positions) {
      qtyByProduct.set(p.productId, (qtyByProduct.get(p.productId) ?? 0) + p.quantity);
    }

    let inStock = 0, low = 0, critical = 0, outOfStock = 0, totalUnits = 0;
    const unitsByProductCategory = new Map<string, number>();
    for (const product of products) {
      const qty = qtyByProduct.get(product.id) ?? 0;
      totalUnits += qty;
      if (qty === 0) outOfStock += 1;
      else if (qty <= product.minLevel) critical += 1;
      else if (qty <= product.reorderPoint) low += 1;
      else inStock += 1;
      if (product.categoryId) {
        unitsByProductCategory.set(product.categoryId, (unitsByProductCategory.get(product.categoryId) ?? 0) + qty);
      }
    }

    // Number of store rooms = root nodes of the STORE_ROOM type.
    const storeRooms = storeRoomCount.length
      ? await this.prisma.locationNode.count({ where: { locationTypeId: storeRoomCount[0].id } })
      : 0;

    return {
      products: products.length,
      shelves: shelfCount,
      storeRooms,
      suppliers: supplierCount,
      totalUnits,
      stockStatus: { inStock, low, critical, outOfStock },
      needsReorder: low + critical + outOfStock,
      movements30d: movements30dCount,
      movementTrend: this.buildMovementTrend(trendMovements, since14),
      categoryBreakdown: this.buildCategoryBreakdown(categories, unitsByProductCategory),
      recommendationsPipeline: this.buildRecommendationsPipeline(recommendationCounts),
      recentActivity: await this.hydrateRecentActivity(recentMovements),
    };
  }

  /** Trailing 14-day series, zero-filled for days with no movements (§8.3-style determinism). */
  private buildMovementTrend(
    movements: Array<{ type: string; quantity: number; createdAt: Date }>,
    since: Date,
  ) {
    const byDay = new Map<string, { goodsIn: number; goodsOut: number }>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      byDay.set(isoDay(d), { goodsIn: 0, goodsOut: 0 });
    }
    for (const m of movements) {
      const key = isoDay(m.createdAt);
      const bucket = byDay.get(key);
      if (!bucket) continue;
      if (m.type === 'GOODS_IN') bucket.goodsIn += m.quantity;
      else if (m.type === 'GOODS_OUT') bucket.goodsOut += m.quantity;
    }
    return [...byDay.entries()].map(([date, v]) => ({ date, goodsIn: v.goodsIn, goodsOut: v.goodsOut }));
  }

  /** Rolls leaf categories up to their top-level ancestor; the smallest are grouped as "Other". */
  private buildCategoryBreakdown(
    categories: Array<{ id: string; parentId: string | null; nameEn: string; nameAr: string }>,
    unitsByCategory: Map<string, number>,
  ) {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const rootOf = (id: string): typeof categories[number] | undefined => {
      let current = byId.get(id);
      const seen = new Set<string>();
      while (current?.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
        seen.add(current.id);
        current = byId.get(current.parentId);
      }
      return current;
    };

    const totals = new Map<string, { nameEn: string; nameAr: string; units: number }>();
    for (const [categoryId, units] of unitsByCategory) {
      const root = rootOf(categoryId);
      if (!root) continue;
      const entry = totals.get(root.id) ?? { nameEn: root.nameEn, nameAr: root.nameAr, units: 0 };
      entry.units += units;
      totals.set(root.id, entry);
    }

    const sorted = [...totals.entries()]
      .map(([categoryId, v]) => ({ categoryId, ...v }))
      .sort((a, b) => b.units - a.units);

    const TOP_N = 6;
    if (sorted.length <= TOP_N) return sorted;
    const head = sorted.slice(0, TOP_N);
    const otherUnits = sorted.slice(TOP_N).reduce((sum, c) => sum + c.units, 0);
    if (otherUnits > 0) head.push({ categoryId: '__other__', nameEn: 'Other', nameAr: 'أخرى', units: otherUnits });
    return head;
  }

  private buildRecommendationsPipeline(counts: Array<{ status: string; _count: { _all: number } }>) {
    const byStatus = new Map(counts.map((c) => [c.status, c._count._all]));
    const order = ['PENDING', 'APPROVED', 'AMENDED', 'ORDERED', 'RECEIVED', 'REJECTED'] as const;
    return order.map((status) => ({ status, count: byStatus.get(status) ?? 0 }));
  }

  private async hydrateRecentActivity(
    movements: Array<{ id: string; type: string; quantity: number; createdAt: Date; productId: string; fromLocationNodeId: string | null; toLocationNodeId: string | null; userId: string }>,
  ) {
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
    const designatorById = new Map(nodes.map((n) => [n.id, n.designator]));
    const userById = new Map(users.map((u) => [u.id, u.displayName]));

    return movements.map((m) => {
      const product = productById.get(m.productId);
      const designator = designatorById.get(m.toLocationNodeId ?? '') ?? designatorById.get(m.fromLocationNodeId ?? '') ?? null;
      return {
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        createdAt: m.createdAt.toISOString(),
        sku: product?.sku ?? '—',
        productNameEn: product?.nameEn ?? '—',
        productNameAr: product?.nameAr ?? '—',
        designator,
        userDisplayName: userById.get(m.userId) ?? '—',
      };
    });
  }
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (n - 1));
  return d;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
