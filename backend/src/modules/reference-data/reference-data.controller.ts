import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';

// Small read-only lookups used to populate forms (§7). All authenticated users.
@ApiTags('reference-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ReferenceDataController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('location-types')
  @ApiOperation({ summary: 'Configured location types (the hierarchy shape)' })
  locationTypes() {
    return this.prisma.locationType.findMany({
      where: { isActive: true },
      orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, code: true, nameEn: true, nameAr: true, depth: true, canHoldStock: true },
    });
  }

  @Get('units-of-measure')
  @ApiOperation({ summary: 'Units of measure' })
  units() {
    return this.prisma.unitOfMeasure.findMany({
      orderBy: [{ isBaseUnit: 'desc' }, { code: 'asc' }],
      select: { id: true, code: true, nameEn: true, nameAr: true, isBaseUnit: true },
    });
  }
}
