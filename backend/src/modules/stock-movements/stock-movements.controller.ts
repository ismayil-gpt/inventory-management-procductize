import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { StockMovementsService } from './stock-movements.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../authentication/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../security/zod-validation.pipe';
import { movementSchema, MovementDto } from './dto/movement.schema';

@ApiTags('stock-movements')
@ApiBearerAuth()
@Controller('stock-movements')
@UseGuards(JwtAuthGuard)
export class StockMovementsController {
  constructor(private readonly movements: StockMovementsService) {}

  @Post()
  @ApiOperation({ summary: 'Record a stock movement (idempotent on clientId)' })
  create(
    @Body(new ZodValidationPipe(movementSchema)) dto: MovementDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.movements.create(dto, user.userId, req.ip);
  }

  @Get()
  @ApiOperation({ summary: 'List stock movements (filters)' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false, description: 'Max rows, default 100, capped at 5000 (used by Stage-2 consumption-history pulls).' })
  list(
    @Query('type') type?: string,
    @Query('productId') productId?: string,
    @Query('locationId') locationId?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.movements.list({ type, productId, locationId, userId, from, to, limit: limit ? Number(limit) : undefined });
  }
}
