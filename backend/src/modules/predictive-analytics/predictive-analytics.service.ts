import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiServiceClientService } from '../../ai-service-client/ai-service-client.service';
import { computeStatus } from '../products/products.service';
import { calculateReorder } from '../replenishment/reorder-calculator';
import { classifyUsageTrend, daysUntilStockout, estimatedReorderCost, round2 } from './predictive-analytics-calculator';

const USAGE_WINDOW_DAYS = 30;
const RECENT_TREND_DAYS = 7;
const SPARKLINE_DAYS = 14;
const STOCKOUT_LIST_SIZE = 12;
const STOCKOUT_ALERT_DAYS = 7;
const DEFAULT_LEAD_TIME_DAYS = 7; // used when a product has no supplier assigned — matches replenishment.service.ts

/**
 * Read-only aggregates for the Predictive Analytics Dashboard. Every figure is a
 * direct read or a deterministic computation from real rows (§8.3, §18) — the
 * "days until stockout" and "projected spend" panels reuse the exact same
 * trailing-30-day-usage and reorder-calculator logic as the daily replenishment
 * review, never a separate estimate. The forecast-vs-actual panel is the one
 * exception: it proxies the ai-service's real Stage-2 forecaster (§8.2), it does
 * not recompute anything here.
 */
@Injectable()
export class PredictiveAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiServiceClientService,
  ) {}

  async summary() {
    const since30 = daysAgo(USAGE_WINDOW_DAYS);
    const since7 = daysAgo(RECENT_TREND_DAYS);

    const [products, positions, suppliers, categories, org, usage30, usage7] = await Promise.all([
      this.prisma.product.findMany({ where: { isActive: true } }),
      this.prisma.stockPosition.findMany({ select: { productId: true, quantity: true } }),
      this.prisma.supplier.findMany({ select: { id: true, name: true, leadTimeDays: true } }),
      this.prisma.productCategory.findMany({ select: { id: true, nameEn: true, nameAr: true } }),
      this.prisma.organization.findFirst({ where: { isActive: true }, select: { currency: true } }),
      this.prisma.stockMovement.groupBy({ by: ['productId'], where: { type: 'GOODS_OUT', createdAt: { gte: since30 } }, _sum: { quantity: true } }),
      this.prisma.stockMovement.groupBy({ by: ['productId'], where: { type: 'GOODS_OUT', createdAt: { gte: since7 } }, _sum: { quantity: true } }),
    ]);

    const stockByProduct = new Map<string, number>();
    for (const p of positions) stockByProduct.set(p.productId, (stockByProduct.get(p.productId) ?? 0) + p.quantity);
    const usage30ByProduct = new Map(usage30.map((r) => [r.productId, r._sum.quantity ?? 0]));
    const usage7ByProduct = new Map(usage7.map((r) => [r.productId, r._sum.quantity ?? 0]));
    const supplierById = new Map(suppliers.map((s) => [s.id, s]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const currency = org?.currency ?? 'AED';

    // ---- Days until stockout + usage trend ----
    type AtRisk = { product: (typeof products)[number]; currentStock: number; dailyUsage: number; days: number };
    const withDays: AtRisk[] = [];
    let trendingUpCount = 0;

    for (const product of products) {
      const currentStock = stockByProduct.get(product.id) ?? 0;
      const sum30 = usage30ByProduct.get(product.id) ?? 0;
      const dailyUsage = sum30 / USAGE_WINDOW_DAYS;
      const sum7 = usage7ByProduct.get(product.id) ?? 0;
      const recentAvg = sum7 / RECENT_TREND_DAYS;
      const baselineAvg = (sum30 - sum7) / (USAGE_WINDOW_DAYS - RECENT_TREND_DAYS);
      if (classifyUsageTrend(recentAvg, baselineAvg) === 'UP') trendingUpCount += 1;

      const days = daysUntilStockout(currentStock, dailyUsage);
      if (days !== null) withDays.push({ product, currentStock, dailyUsage, days });
    }
    withDays.sort((a, b) => a.days - b.days);
    const stockoutWithin7Days = withDays.filter((r) => r.days <= STOCKOUT_ALERT_DAYS).length;
    const topAtRisk = withDays.slice(0, STOCKOUT_LIST_SIZE);
    const sparklineByProduct = await this.sparklines(topAtRisk.map((r) => r.product.id));

    const daysUntilStockoutList = topAtRisk.map((r) => ({
      productId: r.product.id,
      sku: r.product.sku,
      nameEn: r.product.nameEn,
      nameAr: r.product.nameAr,
      currentStock: r.currentStock,
      dailyUsage: round2(r.dailyUsage),
      daysUntilStockout: r.days,
      status: computeStatus(r.currentStock, r.product.minLevel, r.product.reorderPoint),
      sparkline: sparklineByProduct.get(r.product.id) ?? [],
    }));

    // ---- Projected reorder spend (recommended qty x unit cost) ----
    const bySupplier = new Map<string, { supplierId: string | null; supplierName: string | null; amount: number }>();
    const byCategory = new Map<string, { categoryId: string | null; nameEn: string | null; nameAr: string | null; amount: number }>();
    let projectedSpendTotal = 0;
    let reorderNeededCount = 0;

    for (const product of products) {
      const currentStock = stockByProduct.get(product.id) ?? 0;
      const dailyUsage = (usage30ByProduct.get(product.id) ?? 0) / USAGE_WINDOW_DAYS;
      const supplier = product.supplierId ? supplierById.get(product.supplierId) : undefined;
      const leadTimeDays = supplier?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;

      const reorder = calculateReorder({
        currentStock, dailyUsage, leadTimeDays,
        reorderPoint: product.reorderPoint, maxLevel: product.maxLevel, packSize: product.packSize,
      });
      if (!reorder.needsReorder) continue;
      reorderNeededCount += 1;

      const unitCost = product.unitCost !== null ? Number(product.unitCost) : null;
      const cost = estimatedReorderCost(reorder.suggestedQty, unitCost);
      projectedSpendTotal += cost;

      const supplierKey = product.supplierId ?? '__unassigned__';
      const supplierEntry = bySupplier.get(supplierKey) ?? { supplierId: product.supplierId, supplierName: supplier?.name ?? null, amount: 0 };
      supplierEntry.amount += cost;
      bySupplier.set(supplierKey, supplierEntry);

      const category = product.categoryId ? categoryById.get(product.categoryId) : undefined;
      const categoryKey = product.categoryId ?? '__uncategorised__';
      const categoryEntry = byCategory.get(categoryKey) ?? { categoryId: product.categoryId, nameEn: category?.nameEn ?? null, nameAr: category?.nameAr ?? null, amount: 0 };
      categoryEntry.amount += cost;
      byCategory.set(categoryKey, categoryEntry);
    }

    return {
      currency,
      kpis: {
        stockoutWithin7Days,
        projectedSpend: round2(projectedSpendTotal),
        trendingUpCount,
        reorderNeededCount,
      },
      daysUntilStockout: daysUntilStockoutList,
      projectedSpend: {
        total: round2(projectedSpendTotal),
        bySupplier: [...bySupplier.values()].sort((a, b) => b.amount - a.amount).map((s) => ({ ...s, amount: round2(s.amount) })),
        byCategory: [...byCategory.values()].sort((a, b) => b.amount - a.amount).map((c) => ({ ...c, amount: round2(c.amount) })),
      },
    };
  }

  /** Forecast vs. actual for one product — proxies the ai-service's real
   * Stage-2 forecaster; the backend never recomputes or fabricates the line. */
  async forecast(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, nameEn: true, nameAr: true, isActive: true },
    });
    if (!product) {
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', messageEn: 'Product not found.', messageAr: 'المنتج غير موجود.' });
    }
    const forecast = await this.aiService.getForecast(productId);
    return { ...forecast, sku: product.sku, nameEn: product.nameEn, nameAr: product.nameAr };
  }

  /** Trailing-14-day GOODS_OUT sparkline per product, zero-filled. Same
   * bucketing approach as `dashboard.service.ts`'s movement trend, one product
   * at a time so the payload stays tiny (only the shown at-risk products). */
  private async sparklines(productIds: string[]): Promise<Map<string, number[]>> {
    if (productIds.length === 0) return new Map();
    const since = daysAgo(SPARKLINE_DAYS);
    const rows = await this.prisma.stockMovement.findMany({
      where: { type: 'GOODS_OUT', productId: { in: productIds }, createdAt: { gte: since } },
      select: { productId: true, quantity: true, createdAt: true },
    });

    const byProductDay = new Map<string, Map<string, number>>();
    for (const id of productIds) {
      const days = new Map<string, number>();
      for (let i = 0; i < SPARKLINE_DAYS; i++) {
        const d = new Date(since);
        d.setDate(d.getDate() + i);
        days.set(isoDay(d), 0);
      }
      byProductDay.set(id, days);
    }
    for (const r of rows) {
      const days = byProductDay.get(r.productId);
      const key = isoDay(r.createdAt);
      if (days?.has(key)) days.set(key, (days.get(key) ?? 0) + r.quantity);
    }

    const result = new Map<string, number[]>();
    for (const [id, days] of byProductDay) result.set(id, [...days.values()]);
    return result;
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
