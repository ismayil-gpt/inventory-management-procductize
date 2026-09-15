// Bilingual reasoning, generated from computed values via templates — NEVER by a
// language model (§8.3). Deterministic, reproducible, cannot hallucinate, and
// identical on Llama and Qwen. Western digits in both languages (§10).

import type { ReasonCode } from './reorder-calculator';

export interface ReasoningInput {
  currentStock: number;
  dailyUsage: number;
  leadTimeDays: number;
  daysToDepletion: number | null;
  suggestedQty: number;
  reorderPoint: number;
  // Stage 2 (§8.2): which method produced dailyUsage. Defaults to the plain
  // trailing-average wording used since Phase 2.
  reasonCode?: ReasonCode;
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

export function generateReasoning(input: ReasoningInput): { reasoningEn: string; reasoningAr: string } {
  const { currentStock, dailyUsage, leadTimeDays, daysToDepletion, suggestedQty, reorderPoint, reasonCode = 'BELOW_REORDER_POINT' } = input;

  if (dailyUsage > 0 && daysToDepletion !== null) {
    const usage = round1(dailyUsage);

    if (reasonCode === 'FORECAST_DEPLETION') {
      return {
        reasoningEn: `Stock is ${currentStock} units. The demand forecast projects ${usage} units of use per day, and delivery takes ${leadTimeDays} days, so stock is forecast to run out in about ${daysToDepletion} days. Recommend ordering ${suggestedQty} units.`,
        reasoningAr: `المخزون ${currentStock} وحدة. يتوقع نموذج الطلب استهلاك ${usage} وحدة يوميًا، والتوريد يستغرق ${leadTimeDays} يومًا، لذا يُتوقع نفاد المخزون خلال ${daysToDepletion} يومًا تقريبًا. يوصى بطلب ${suggestedQty} وحدة.`,
      };
    }
    if (reasonCode === 'SEASONAL_UPLIFT') {
      return {
        reasoningEn: `Stock is ${currentStock} units. A seasonal increase in demand is expected, projected at ${usage} units per day, and delivery takes ${leadTimeDays} days, so stock is forecast to run out in about ${daysToDepletion} days. Recommend ordering ${suggestedQty} units.`,
        reasoningAr: `المخزون ${currentStock} وحدة. يُتوقع ارتفاع موسمي في الطلب بمعدل ${usage} وحدة يوميًا، والتوريد يستغرق ${leadTimeDays} يومًا، لذا يُتوقع نفاد المخزون خلال ${daysToDepletion} يومًا تقريبًا. يوصى بطلب ${suggestedQty} وحدة.`,
      };
    }
    return {
      reasoningEn: `Stock is ${currentStock} units. Average use is ${usage} units per day and delivery takes ${leadTimeDays} days, so stock will run out in about ${daysToDepletion} days. Recommend ordering ${suggestedQty} units.`,
      reasoningAr: `المخزون ${currentStock} وحدة. متوسط الاستهلاك ${usage} وحدة يوميًا والتوريد يستغرق ${leadTimeDays} يومًا، لذا سينفد المخزون خلال ${daysToDepletion} يومًا تقريبًا. يوصى بطلب ${suggestedQty} وحدة.`,
    };
  }

  return {
    reasoningEn: `Stock is ${currentStock} units, at or below the reorder point of ${reorderPoint}. No recent usage recorded. Recommend ordering ${suggestedQty} units.`,
    reasoningAr: `المخزون ${currentStock} وحدة، عند نقطة إعادة الطلب (${reorderPoint}) أو أقل. لا يوجد استهلاك حديث مسجّل. يوصى بطلب ${suggestedQty} وحدة.`,
  };
}
