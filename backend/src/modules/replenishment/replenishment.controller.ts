import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ReplenishmentService } from './replenishment.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../authentication/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../security/zod-validation.pipe';
import { approveSchema, ApproveDto, rejectSchema, RejectDto } from './dto/decision.schema';
import { runReviewSchema, RunReviewDto } from './dto/run.schema';

@ApiTags('replenishment')
@ApiBearerAuth()
@Controller('recommendations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReplenishmentController {
  constructor(private readonly replenishment: ReplenishmentService) {}

  @Get()
  @ApiOperation({ summary: 'List reorder recommendations' })
  @ApiQuery({ name: 'status', required: false })
  list(@Query('status') status?: string) {
    return this.replenishment.list(status);
  }

  @Post('run')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Run the reorder review now (ADMIN). Optionally carries Stage-2 forecast overrides (§8.2).' })
  run(@Body(new ZodValidationPipe(runReviewSchema)) dto: RunReviewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.replenishment.runReview(user.userId, dto.forecasts);
  }

  @Post(':id/approve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve (or amend) a recommendation (ADMIN)' })
  approve(@Param('id') id: string, @Body(new ZodValidationPipe(approveSchema)) dto: ApproveDto, @CurrentUser() user: AuthenticatedUser) {
    return this.replenishment.approve(id, user.userId, dto.approvedQty);
  }

  @Post(':id/reject')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject a recommendation (ADMIN)' })
  reject(@Param('id') id: string, @Body(new ZodValidationPipe(rejectSchema)) dto: RejectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.replenishment.reject(id, user.userId, dto.reason);
  }
}
