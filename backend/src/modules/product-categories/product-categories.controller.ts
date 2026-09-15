import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';

@ApiTags('product-categories')
@ApiBearerAuth()
@Controller('product-categories')
@UseGuards(JwtAuthGuard)
export class ProductCategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List product categories' })
  list() {
    return this.prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
      select: { id: true, code: true, nameEn: true, nameAr: true, parentId: true },
    });
  }
}
