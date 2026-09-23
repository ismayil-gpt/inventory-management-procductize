// Deterministic helpers for the Predictive Analytics Dashboard (§8.3, §18). No
// AI/LLM here — every figure traces to real stock, movement and cost data, same
// spirit as `replenishment/reorder-calculator.ts`.

/** Whole days of cover left at the given daily usage rate. `null` when there is
 * no recent usage to divide by — honestly "unknown", never a fabricated number. */
export function daysUntilStockout(currentStock: number, dailyUsage: number): number | null {
  if (dailyUsage <= 0) return null;
  return Math.floor(currentStock / dailyUsage);
}

export type UsageTrend = 'UP' | 'DOWN' | 'FLAT';

// Recent (trailing 7-day) vs. baseline (the preceding window) daily-usage
// comparison — the same 25%-band spirit as the ai-service's seasonal uplift
// detector (`seasonal_analyser.UPLIFT_THRESHOLD`), applied here without that
// detector's longer 90-day minimum so a trend signal exists at 30 days.
const TREND_UP_THRESHOLD = 1.15;
const TREND_DOWN_THRESHOLD = 0.85;

export function classifyUsageTrend(recentAvg: number, baselineAvg: number): UsageTrend {
  if (baselineAvg <= 0) return recentAvg > 0 ? 'UP' : 'FLAT';
  const ratio = recentAvg / baselineAvg;
  if (ratio >= TREND_UP_THRESHOLD) return 'UP';
  if (ratio <= TREND_DOWN_THRESHOLD) return 'DOWN';
  return 'FLAT';
}

/** Recommended-quantity × unit cost. `null`/missing unit cost costs 0, not a guess. */
export function estimatedReorderCost(suggestedQty: number, unitCost: number | null | undefined): number {
  if (unitCost === null || unitCost === undefined) return 0;
  return suggestedQty * unitCost;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
