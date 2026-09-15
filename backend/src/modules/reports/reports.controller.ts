import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService, ReportData } from './reports.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private async send(res: Response, data: ReportData, format: string, filename: string) {
    if (format === 'pdf') {
      const buffer = await this.reports.toPdf(data);
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}.pdf"` });
      res.send(buffer);
    } else {
      const buffer = await this.reports.toXlsx(data);
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${filename}.xlsx"` });
      res.send(buffer);
    }
  }

  @Get('stock-on-hand')
  @ApiOperation({ summary: 'Stock-on-hand report (pdf|xlsx)' })
  @ApiQuery({ name: 'format', required: false, enum: ['pdf', 'xlsx'] })
  async stockOnHand(@Res() res: Response, @Query('format') format = 'xlsx') {
    await this.send(res, await this.reports.stockOnHand(), format, 'mizan-stock-on-hand');
  }

  @Get('stock-movements')
  @ApiOperation({ summary: 'Stock-movements report (pdf|xlsx)' })
  @ApiQuery({ name: 'format', required: false, enum: ['pdf', 'xlsx'] })
  async stockMovements(@Res() res: Response, @Query('format') format = 'xlsx') {
    await this.send(res, await this.reports.stockMovements(), format, 'mizan-stock-movements');
  }

  @Get('replenishment')
  @ApiOperation({ summary: 'Replenishment report (pdf|xlsx)' })
  @ApiQuery({ name: 'format', required: false, enum: ['pdf', 'xlsx'] })
  async replenishment(@Res() res: Response, @Query('format') format = 'xlsx') {
    await this.send(res, await this.reports.replenishment(), format, 'mizan-replenishment');
  }
}
