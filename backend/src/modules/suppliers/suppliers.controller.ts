import { Body, Controller, ConflictException, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../authentication/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../security/zod-validation.pipe';

const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().email(),
  phone: z.string().trim().max(40).optional().nullable(),
  leadTimeDays: z.number().int().min(0).max(365),
  isActive: z.boolean().default(true),
});
const updateSupplierSchema = createSupplierSchema.partial();
type CreateSupplierDto = z.infer<typeof createSupplierSchema>;
type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List suppliers' })
  list() {
    return this.prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a supplier (ADMIN)' })
  async create(@Body(new ZodValidationPipe(createSupplierSchema)) dto: CreateSupplierDto, @CurrentUser() user: AuthenticatedUser) {
    const created = await this.prisma.supplier.create({ data: { name: dto.name, email: dto.email, phone: dto.phone ?? null, leadTimeDays: dto.leadTimeDays, isActive: dto.isActive } });
    await this.prisma.auditLog.create({ data: { actorId: user.userId, action: 'SUPPLIER_CREATE', entityType: 'Supplier', entityId: created.id, after: created as unknown as object } });
    return created;
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a supplier (ADMIN)' })
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(updateSupplierSchema)) dto: UpdateSupplierDto, @CurrentUser() user: AuthenticatedUser) {
    const before = await this.prisma.supplier.findUnique({ where: { id } });
    const updated = await this.prisma.supplier.update({ where: { id }, data: dto });
    await this.prisma.auditLog.create({ data: { actorId: user.userId, action: 'SUPPLIER_UPDATE', entityType: 'Supplier', entityId: id, before: before as unknown as object, after: updated as unknown as object } });
    return updated;
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a supplier that is used by no product or purchase order (ADMIN). Otherwise deactivate.' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException({ code: 'SUPPLIER_NOT_FOUND', messageEn: 'Supplier not found.', messageAr: 'المورّد غير موجود.' });

    const [products, purchaseOrders] = await Promise.all([
      this.prisma.product.count({ where: { supplierId: id } }),
      this.prisma.purchaseOrder.count({ where: { supplierId: id } }),
    ]);
    if (products + purchaseOrders > 0) {
      throw new ConflictException({ code: 'SUPPLIER_IN_USE', messageEn: 'This supplier is linked to products or purchase orders and cannot be deleted. Deactivate it instead.', messageAr: 'هذا المورّد مرتبط بمنتجات أو أوامر شراء ولا يمكن حذفه. قم بإلغاء تفعيله بدلاً من ذلك.' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.delete({ where: { id } });
      await tx.auditLog.create({ data: { actorId: user.userId, action: 'SUPPLIER_DELETE', entityType: 'Supplier', entityId: id, before: supplier as unknown as object } });
    });
    return { deleted: true };
  }
}
