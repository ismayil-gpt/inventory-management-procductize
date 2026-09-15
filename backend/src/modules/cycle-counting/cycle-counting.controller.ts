import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { CycleCountingService } from './cycle-counting.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../authentication/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../security/zod-validation.pipe';
import { createCycleCountSchema, CreateCycleCountDto, scanSchema, ScanDto, closeSchema, CloseDto } from './dto/cycle-count.schema';

@ApiTags('cycle-counting')
@ApiBearerAuth()
@Controller('cycle-counts')
@UseGuards(JwtAuthGuard)
export class CycleCountingController {
  constructor(private readonly cycleCounts: CycleCountingService) {}

  @Get()
  @ApiOperation({ summary: 'List cycle-count sessions' })
  list() {
    return this.cycleCounts.list();
  }

  @Post()
  @ApiOperation({ summary: 'Start a cycle-count session' })
  create(@Body(new ZodValidationPipe(createCycleCountSchema)) dto: CreateCycleCountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cycleCounts.create(dto.note, user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Session with its live variance report' })
  get(@Param('id') id: string) {
    return this.cycleCounts.get(id);
  }

  @Post(':id/scan')
  @ApiOperation({ summary: 'Record a counted quantity for a product at a location' })
  scan(@Param('id') id: string, @Body(new ZodValidationPipe(scanSchema)) dto: ScanDto) {
    return this.cycleCounts.scan(id, dto);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close the session; optionally apply variances as ADJUSTMENT movements' })
  close(@Param('id') id: string, @Body(new ZodValidationPipe(closeSchema)) dto: CloseDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.cycleCounts.close(id, dto.apply, user.userId, req.ip);
  }
}
