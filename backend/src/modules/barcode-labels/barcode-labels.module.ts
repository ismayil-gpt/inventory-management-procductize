import { Module } from '@nestjs/common';
import { BarcodeLabelsController } from './barcode-labels.controller';
import { BarcodeLabelsService } from './barcode-labels.service';

@Module({
  controllers: [BarcodeLabelsController],
  providers: [BarcodeLabelsService],
  exports: [BarcodeLabelsService],
})
export class BarcodeLabelsModule {}
