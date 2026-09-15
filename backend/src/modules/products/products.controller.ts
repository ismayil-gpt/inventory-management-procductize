import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../authentication/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../security/zod-validation.pipe';
import { createProductSchema, CreateProductDto, updateProductSchema, UpdateProductDto } from './dto/product.schema';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a product (ADMIN). Generates an internal barcode if none given.' })
  create(@Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.products.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a product (ADMIN)' })
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.products.update(id, dto, user.userId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a product with no stock or history (ADMIN). Otherwise deactivate.' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.products.remove(id, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List products (search, category, low-stock filters)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  list(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.products.list({ search, categoryId, lowStock: lowStock === 'true' });
  }

  // Static route before :id so "resolve" is not treated as an id.
  @Get('resolve/:barcode')
  @ApiOperation({ summary: 'Resolve a product by its barcode (scanned or typed)' })
  resolve(@Param('barcode') barcode: string) {
    return this.products.resolveByBarcode(barcode);
  }

  @Get('import-template')
  @ApiOperation({ summary: 'Download the Excel product-import template' })
  async importTemplate(@Res() res: Response) {
    const buffer = await this.products.importTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="mizan-product-import-template.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import')
  @Roles(Role.ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import products from Excel (ADMIN). ?dryRun=true to validate only.' })
  @ApiQuery({ name: 'dryRun', required: false, type: Boolean })
  import(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser, @Query('dryRun') dryRun?: string) {
    return this.products.importProducts(file.buffer, dryRun === 'true', user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Product detail with stock positions' })
  getById(@Param('id') id: string) {
    return this.products.getById(id);
  }

  @Get(':id/stock')
  @ApiOperation({ summary: 'Stock positions for a product across locations' })
  stock(@Param('id') id: string) {
    return this.products.stockPositions(id);
  }
}
