import { Module } from '@nestjs/common';
import { CycleCountingController } from './cycle-counting.controller';
import { CycleCountingService } from './cycle-counting.service';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';

@Module({
  imports: [StockMovementsModule], // reuse the audited ADJUSTMENT path when applying variances
  controllers: [CycleCountingController],
  providers: [CycleCountingService],
})
export class CycleCountingModule {}
