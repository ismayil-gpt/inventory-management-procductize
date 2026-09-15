// Deterministic reorder logic. Ref: CLAUDE.md §8.2. No AI/LLM — transparent,
// reproducible and defensible to an auditor. Stage 2 swaps `dailyUsage` for a
// forecast without changing this interface.

export type ReasonCode = 'BELOW_REORDER_POINT' | 'FORECAST_DEPLETION' | 'SEASONAL_UPLIFT';

export interface ReorderInput {
  currentStock: number;
  dailyUsage: number; // trailing 30-day average of GOODS_OUT, or a Stage-2 forecast (§8.2)
  leadTimeDays: number;
  reorderPoint: number;
  maxLevel: number;
  packSize: number;
  // Stage 2: which method produced `dailyUsage`, when it wasn't the plain trailing
  // average. Defaults to BELOW_REORDER_POINT — the formula below is identical
  // either way, only the input and the resulting label differ (§8.2).
  reasonCode?: ReasonCode;
}

export interface ReorderResult {
  needsReorder: boolean;
  effectiveRop: number;
  suggestedQty: number;
  daysToDepletion: number | null; // null when there is no recent usage
  reasonCode: ReasonCode;
}

function roundUpToPack(qty: number, packSize: number): number {
  if (packSize <= 1) return qty;
  return Math.ceil(qty / packSize) * packSize;
}

export function calculateReorder(input: ReorderInput): ReorderResult {
  const { currentStock, dailyUsage, leadTimeDays, reorderPoint, maxLevel, packSize, reasonCode = 'BELOW_REORDER_POINT' } = input;

  const leadTimeDemand = dailyUsage * leadTimeDays;
  const safetyStock = dailyUsage * 3;
  const effectiveRop = Math.max(reorderPoint, Math.ceil(leadTimeDemand + safetyStock));
  const needsReorder = currentStock <= effectiveRop;

  let suggestedQty = 0;
  if (needsReorder) {
    const raw = Math.max(maxLevel - currentStock, dailyUsage * leadTimeDays * 1.5);
    suggestedQty = roundUpToPack(Math.max(1, Math.ceil(raw)), packSize);
  }

  const daysToDepletion = dailyUsage > 0 ? Math.floor(currentStock / dailyUsage) : null;
  return { needsReorder, effectiveRop, suggestedQty, daysToDepletion, reasonCode };
}
