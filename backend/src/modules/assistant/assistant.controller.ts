import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AssistantService } from './assistant.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../authentication/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../security/zod-validation.pipe';
import { assistantQuerySchema, AssistantQueryDto } from './dto/query.schema';

@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('query')
  @ApiOperation({ summary: 'Ask the inventory assistant a natural-language question (§8.4)' })
  query(@Body(new ZodValidationPipe(assistantQuerySchema)) dto: AssistantQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assistant.query(dto, user.userId);
  }
}
