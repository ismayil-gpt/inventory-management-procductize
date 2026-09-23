import { Module } from '@nestjs/common';
import { PredictiveAnalyticsController } from './predictive-analytics.controller';
import { PredictiveAnalyticsService } from './predictive-analytics.service';
import { AiServiceClientModule } from '../../ai-service-client/ai-service-client.module';

@Module({
  imports: [AiServiceClientModule],
  controllers: [PredictiveAnalyticsController],
  providers: [PredictiveAnalyticsService],
})
export class PredictiveAnalyticsModule {}
