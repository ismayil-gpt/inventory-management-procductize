import { z } from 'zod';

// Stage 2 (§8.2, §13.5): the ai-service's demand-forecasting job MAY supply a
// forecasted daily-usage figure per product, computed from real consumption
// history (statsmodels). Optional and additive — when omitted, `runReview`
// falls back to the existing deterministic 30-day trailing average unchanged.
// The reorder-calculator's interface never changes, only this input (§8.2).
export const runReviewSchema = z
  .object({
    forecasts: z
      .record(
        z.string(),
        z.object({
          dailyUsage: z.number().min(0),
          reasonCode: z.enum(['FORECAST_DEPLETION', 'SEASONAL_UPLIFT']),
        }),
      )
      .optional(),
  })
  // The existing manual "Run now" trigger (admin UI, and any caller before Stage 2)
  // sends no body at all — keep that working unchanged.
  .default({});
export type RunReviewDto = z.infer<typeof runReviewSchema>;
