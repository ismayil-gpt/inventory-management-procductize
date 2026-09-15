import { Module } from '@nestjs/common';
import { AiServiceClientService } from './ai-service-client.service';

@Module({
  providers: [AiServiceClientService],
  exports: [AiServiceClientService],
})
export class AiServiceClientModule {}
