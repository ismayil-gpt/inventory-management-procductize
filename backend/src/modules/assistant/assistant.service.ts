import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { AiServiceClientService } from '../../ai-service-client/ai-service-client.service';
import { AssistantQueryDto } from './dto/query.schema';

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiServiceClient: AiServiceClientService,
  ) {}

  /**
   * §8.4 — the model never generates figures, only phrases data the ai-service
   * retrieved from the backend. Every query is audited (DESC #9), same as any
   * other user action, even though it doesn't change state.
   */
  async query(dto: AssistantQueryDto, userId: string) {
    const result = await this.aiServiceClient.queryAssistant(dto.text, dto.language);

    // AuditLog is append-only (no UPDATE/DELETE, per migration 0001) — generate the
    // entityId up front rather than back-filling it after create.
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'ASSISTANT_QUERY',
        entityType: 'AssistantQuery',
        entityId: randomUUID(),
        after: { text: dto.text, language: dto.language, sourceCount: result.sources.length },
      },
    });

    return { answer: result.answer, sources: result.sources, isDevelopmentModel: result.isDevelopmentModel };
  }
}
