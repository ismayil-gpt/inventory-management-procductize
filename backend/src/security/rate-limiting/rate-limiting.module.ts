import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

/**
 * Rate-limit settings come from the environment (§2: laptop and server differ
 * only by configuration). Counters live in process memory, which is correct
 * for the single backend instance this deployment runs. If the API is ever
 * scaled to several instances, swap in a Redis-backed throttler storage here;
 * no controller changes.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'auth',
          ttl: Number(config.get('AUTH_RATE_LIMIT_WINDOW_SECONDS', 60)) * 1000,
          limit: Number(config.get('AUTH_RATE_LIMIT_MAX_REQUESTS', 10)),
        },
      ],
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitingModule {}
