import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AssistantQueryResult {
  answer: string;
  sources: Array<{ type: string; id: string; label: string; value: unknown }>;
  isDevelopmentModel: boolean;
}

export interface ForecastResult {
  productId: string;
  historyDays: number;
  minHistoryForForecast: number;
  minHistoryForSeasonality: number;
  hasForecast: boolean;
  hasSufficientHistoryForSeasonality: boolean;
  hasSeasonalSignal: boolean;
  dailyUsageForecast: number | null;
  history: Array<{ date: string; actual: number }>;
  forecast: Array<{ date: string; value: number }>;
}

/**
 * Typed client for the internal-only ai-service (§3.2). Plain `fetch` — matches the
 * project's existing minimalism (raw `httpx` on the Python side, no wrapper library).
 * ai-service is never reachable from outside the internal network (DESC #11); only
 * the backend calls it.
 */
@Injectable()
export class AiServiceClientService {
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
  }

  async queryAssistant(text: string, language: 'en' | 'ar'): Promise<AssistantQueryResult> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'AI_SERVICE_UNREACHABLE',
        messageEn: 'The assistant is temporarily unavailable. Please try again shortly.',
        messageAr: 'المساعد غير متاح مؤقتًا. يرجى المحاولة مرة أخرى بعد قليل.',
      });
    }
    if (!response.ok) {
      throw new ServiceUnavailableException({
        code: 'AI_SERVICE_ERROR',
        messageEn: 'The assistant could not answer that question.',
        messageAr: 'تعذر على المساعد الإجابة عن هذا السؤال.',
      });
    }
    return (await response.json()) as AssistantQueryResult;
  }

  /** Forecast vs. actual daily usage for one product (§8.2 Stage 2), from the
   * real ai-service forecaster — never re-implemented here (§18). */
  async getForecast(productId: string): Promise<ForecastResult> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/forecasting/products/${productId}`, {
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'AI_SERVICE_UNREACHABLE',
        messageEn: 'The forecasting service is temporarily unavailable. Please try again shortly.',
        messageAr: 'خدمة التنبؤ غير متاحة مؤقتًا. يرجى المحاولة مرة أخرى بعد قليل.',
      });
    }
    if (!response.ok) {
      throw new ServiceUnavailableException({
        code: 'AI_SERVICE_ERROR',
        messageEn: 'Could not compute a forecast for this product.',
        messageAr: 'تعذّر حساب توقع لهذا المنتج.',
      });
    }
    return (await response.json()) as ForecastResult;
  }
}
