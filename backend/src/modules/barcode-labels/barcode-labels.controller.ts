import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { z } from 'zod';
import { BarcodeLabelsService } from './barcode-labels.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../security/zod-validation.pipe';

const batchSchema = z.object({
  type: z.enum(['product', 'location']),
  ids: z.array(z.string().min(1)).min(1).max(500),
});
type BatchDto = z.infer<typeof batchSchema>;

@ApiTags('barcode-labels')
@ApiBearerAuth()
@Controller('barcode-labels')
@UseGuards(JwtAuthGuard)
export class BarcodeLabelsController {
  constructor(private readonly labels: BarcodeLabelsService) {}

  @Get('product/:id')
  @ApiOperation({ summary: 'Label data (barcode PNG + text) for one product' })
  product(@Param('id') id: string) {
    return this.labels.productLabels([id]);
  }

  @Get('location/:id')
  @ApiOperation({ summary: 'Label data for one location, or a whole subtree' })
  @ApiQuery({ name: 'includeDescendants', required: false, type: Boolean })
  async location(@Param('id') id: string, @Query('includeDescendants') includeDescendants?: string) {
    if (includeDescendants === 'true') {
      const ids = await this.labels.locationSubtreeShelfIds(id);
      return this.labels.locationLabels(ids);
    }
    return this.labels.locationLabels([id]);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Label data for many products or locations' })
  batch(@Body(new ZodValidationPipe(batchSchema)) dto: BatchDto) {
    return dto.type === 'product' ? this.labels.productLabels(dto.ids) : this.labels.locationLabels(dto.ids);
  }
}
