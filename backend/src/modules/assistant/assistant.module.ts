import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AiServiceClientModule } from '../../ai-service-client/ai-service-client.module';

@Module({
  imports: [AiServiceClientModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
