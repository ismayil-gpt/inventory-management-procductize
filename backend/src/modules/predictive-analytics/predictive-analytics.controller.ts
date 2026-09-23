import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PredictiveAnalyticsService } from './predictive-analytics.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';

@ApiTags('predictive-analytics')
@ApiBearerAuth()
@Controller('predictive-analytics')
@UseGuards(JwtAuthGuard)
export class PredictiveAnalyticsController {
  constructor(private readonly predictiveAnalytics: PredictiveAnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Predictive analytics summary: stockout risk, usage trend, projected reorder spend (read-only, both roles)' })
  summary() {
    return this.predictiveAnalytics.summary();
  }

  @Get('forecast/:productId')
  @ApiOperation({ summary: 'Forecast vs. actual daily usage for one product (§8.2 Stage 2, proxies ai-service)' })
  forecast(@Param('productId') productId: string) {
    return this.predictiveAnalytics.forecast(productId);
  }
}
