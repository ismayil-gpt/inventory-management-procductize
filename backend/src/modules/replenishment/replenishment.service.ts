import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { RecommendationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { calculateReorder, ReasonCode } from './reorder-calculator';
import { generateReasoning } from './reasoning-generator';

const DEFAULT_LEAD_TIME_DAYS = 7; // used when a product has no supplier assigned
const USAGE_WINDOW_DAYS = 30;

export interface ForecastOverride {
  dailyUsage: number;
  reasonCode: ReasonCode;
}

@Injectable()
export class ReplenishmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The daily review (§8.1/§8.2). Deterministic; safe to run repeatedly.
   *
   * `forecasts` is an optional, additive Stage-2 input: a per-product override of
   * `dailyUsage` computed by the ai-service's demand-forecasting job from real
   * consumption history. When a product has no override, the existing 30-day
   * trailing-average path is used unchanged — the formula and the manual
   * admin "Run now" trigger are untouched by this (§8.2: same interface, only
   * the input changes).
   */
  async runReview(userId: string, forecasts?: Record<string, ForecastOverride>) {
    const products = await this.prisma.product.findMany({ where: { isActive: true } });
    const [positions, suppliers, usage, activeRecs, rejectedToday] = await Promise.all([
      this.prisma.stockPosition.findMany({ select: { productId: true, quantity: true } }),
      this.prisma.supplier.findMany({ select: { id: true, leadTimeDays: true } }),
      this.trailingUsage(),
      // Products with an in-flight recommendation (pending decision or already on
      // order) — don't duplicate. RECEIVED is intentionally excluded so a product
      // that runs low again after delivery can be recommended anew.
      this.prisma.recommendation.findMany({ where: { status: { in: ['PENDING', 'APPROVED', 'AMENDED', 'ORDERED'] } }, select: { productId: true } }),
      // §12 r6 — a product rejected today is not re-recommended the same day.
      this.prisma.recommendation.findMany({ where: { status: 'REJECTED', generatedAt: { gte: this.startOfToday() } }, select: { productId: true } }),
    ]);

    const stockByProduct = new Map<string, number>();
    for (const p of positions) stockByProduct.set(p.productId, (stockByProduct.get(p.productId) ?? 0) + p.quantity);
    const leadBySupplier = new Map(suppliers.map((s) => [s.id, s.leadTimeDays]));
    const skip = new Set([...activeRecs, ...rejectedToday].map((r) => r.productId));

    let generated = 0;
    for (const product of products) {
      if (skip.has(product.id)) continue;
      const currentStock = stockByProduct.get(product.id) ?? 0;
      const forecast = forecasts?.[product.id];
      const dailyUsage = forecast?.dailyUsage ?? (usage.get(product.id) ?? 0) / USAGE_WINDOW_DAYS;
      const reasonCode: ReasonCode = forecast?.reasonCode ?? 'BELOW_REORDER_POINT';
      const leadTimeDays = product.supplierId ? leadBySupplier.get(product.supplierId) ?? DEFAULT_LEAD_TIME_DAYS : DEFAULT_LEAD_TIME_DAYS;

      const result = calculateReorder({ currentStock, dailyUsage, leadTimeDays, reorderPoint: product.reorderPoint, maxLevel: product.maxLevel, packSize: product.packSize, reasonCode });
      if (!result.needsReorder) continue;

      const reasoning = generateReasoning({ currentStock, dailyUsage, leadTimeDays, daysToDepletion: result.daysToDepletion, suggestedQty: result.suggestedQty, reorderPoint: product.reorderPoint, reasonCode: result.reasonCode });

      await this.prisma.$transaction(async (tx) => {
        const rec = await tx.recommendation.create({
          data: {
            productId: product.id,
            suggestedQty: result.suggestedQty,
            reasonCode: result.reasonCode,
            reasoningEn: reasoning.reasoningEn,
            reasoningAr: reasoning.reasoningAr,
            status: 'PENDING',
          },
        });
        await tx.auditLog.create({ data: { actorId: userId, action: 'RECOMMENDATION_GENERATED', entityType: 'Recommendation', entityId: rec.id, after: { productId: product.id, suggestedQty: result.suggestedQty } } });
      });
      generated += 1;
    }

    return { generated, reviewedAt: new Date().toISOString() };
  }

  async list(status?: string) {
    const where = status ? { status: status as RecommendationStatus } : {};
    const recs = await this.prisma.recommendation.findMany({ where, orderBy: { generatedAt: 'desc' }, take: 200 });
    return this.enrich(recs);
  }

  async approve(id: string, userId: string, approvedQty?: number) {
    const rec = await this.mustBePending(id);
    const qty = approvedQty ?? rec.suggestedQty;
    if (qty <= 0) throw new BadRequestException({ code: 'INVALID_QTY', messageEn: 'Approved quantity must be greater than zero.', messageAr: 'يجب أن تكون الكمية المعتمدة أكبر من صفر.' });
    const status: RecommendationStatus = qty === rec.suggestedQty ? 'APPROVED' : 'AMENDED';
    await this.prisma.$transaction(async (tx) => {
      await tx.recommendation.update({ where: { id }, data: { status, approvedQty: qty, decidedByUserId: userId, decidedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: userId, action: `RECOMMENDATION_${status}`, entityType: 'Recommendation', entityId: id, before: { status: rec.status, suggestedQty: rec.suggestedQty }, after: { status, approvedQty: qty } } });
    });
    return this.getOne(id);
  }

  async reject(id: string, userId: string, reason: string) {
    const rec = await this.mustBePending(id);
    if (!reason || reason.trim().length < 3) throw new BadRequestException({ code: 'REASON_REQUIRED', messageEn: 'A rejection reason is required.', messageAr: 'سبب الرفض مطلوب.' });
    await this.prisma.$transaction(async (tx) => {
      await tx.recommendation.update({ where: { id }, data: { status: 'REJECTED', decidedByUserId: userId, decidedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'RECOMMENDATION_REJECTED', entityType: 'Recommendation', entityId: id, before: { status: rec.status }, after: { status: 'REJECTED', reason: reason.trim() } } });
    });
    return this.getOne(id);
  }

  // ---- helpers ----

  private async mustBePending(id: string) {
    const rec = await this.prisma.recommendation.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException({ code: 'RECOMMENDATION_NOT_FOUND', messageEn: 'Recommendation not found.', messageAr: 'التوصية غير موجودة.' });
    if (rec.status !== 'PENDING') throw new BadRequestException({ code: 'ALREADY_DECIDED', messageEn: 'This recommendation has already been decided.', messageAr: 'تم البتّ في هذه التوصية بالفعل.' });
    return rec;
  }

  private async getOne(id: string) {
    const rec = await this.prisma.recommendation.findUniqueOrThrow({ where: { id } });
    return (await this.enrich([rec]))[0];
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async trailingUsage(): Promise<Map<string, number>> {
    const since = new Date(Date.now() - USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { type: 'GOODS_OUT', createdAt: { gte: since } },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
  }

  private async enrich(recs: Array<{ id: string; productId: string; suggestedQty: number; approvedQty: number | null; reasonCode: string; reasoningEn: string; reasoningAr: string; status: string; generatedAt: Date; decidedAt: Date | null; purchaseOrderId: string | null }>) {
    if (recs.length === 0) return [];
    const productIds = [...new Set(recs.map((r) => r.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, sku: true, nameEn: true, nameAr: true, supplierId: true } });
    const supplierIds = [...new Set(products.map((p) => p.supplierId).filter((v): v is string => Boolean(v)))];
    const suppliers = await this.prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } });
    const productById = new Map(products.map((p) => [p.id, p]));
    const supplierById = new Map(suppliers.map((s) => [s.id, s]));
    return recs.map((r) => {
      const product = productById.get(r.productId);
      const supplier = product?.supplierId ? supplierById.get(product.supplierId) : undefined;
      return {
        id: r.id,
        productId: r.productId,
        sku: product?.sku ?? '—',
        nameEn: product?.nameEn ?? '—',
        nameAr: product?.nameAr ?? '—',
        supplierId: product?.supplierId ?? null,
        supplierName: supplier?.name ?? null,
        suggestedQty: r.suggestedQty,
        approvedQty: r.approvedQty,
        reasonCode: r.reasonCode,
        reasoningEn: r.reasoningEn,
        reasoningAr: r.reasoningAr,
        status: r.status,
        generatedAt: r.generatedAt,
        decidedAt: r.decidedAt,
        purchaseOrderId: r.purchaseOrderId,
      };
    });
  }
}
