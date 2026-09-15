import { Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { PurchaseOrdersService } from './purchase-orders.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../authentication/decorators/current-user.decorator';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List purchase orders' })
  list() {
    return this.purchaseOrders.list();
  }

  @Post('generate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Generate POs from approved recommendations, grouped by supplier (ADMIN)' })
  generate(@CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrders.generateFromApproved(user.userId);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download a purchase order as PDF' })
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const { buffer, poNumber } = await this.purchaseOrders.pdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${poNumber}.pdf"` });
    res.send(buffer);
  }
}
