import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * DESC control 12 — rate limiting on every /auth/* endpoint (CLAUDE.md §11.1).
 *
 * Counts requests per client IP and per endpoint over a sliding window. This
 * sits in front of account lockout (control 5): lockout protects one account
 * from repeated guesses, rate limiting stops one client from trying many
 * accounts. The refusal uses the API's bilingual error shape (§14).
 */
@Injectable()
export class AuthRateLimitGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        code: 'RATE_LIMITED',
        messageEn: 'Too many sign-in attempts from this device. Wait a minute, then try again.',
        messageAr: 'محاولات تسجيل دخول كثيرة من هذا الجهاز. انتظر دقيقة ثم حاول مرة أخرى.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
