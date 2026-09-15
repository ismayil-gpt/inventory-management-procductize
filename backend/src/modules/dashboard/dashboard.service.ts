import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Dashboard summary computed from seeded data. Stock state per product follows
 * §9.8: out (0), critical (<= minLevel), low (<= reorderPoint), else in stock.
 * (The schema uses scalar foreign keys with no relations, so totals are summed
 * in code rather than via nested aggregation.)
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [products, positions, shelfCount, storeRoomCount, supplierCount] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, reorderPoint: true, minLevel: true },
      }),
      this.prisma.stockPosition.findMany({ select: { productId: true, quantity: true } }),
      this.prisma.locationNode.count({ where: { barcode: { not: null }, isActive: true } }),
      this.prisma.locationType.findMany({ where: { code: 'STORE_ROOM' }, select: { id: true } }),
      this.prisma.supplier.count({ where: { isActive: true } }),
    ]);

    const qtyByProduct = new Map<string, number>();
    for (const p of positions) {
      qtyByProduct.set(p.productId, (qtyByProduct.get(p.productId) ?? 0) + p.quantity);
    }

    let inStock = 0, low = 0, critical = 0, outOfStock = 0, totalUnits = 0;
    for (const product of products) {
      const qty = qtyByProduct.get(product.id) ?? 0;
      totalUnits += qty;
      if (qty === 0) outOfStock += 1;
      else if (qty <= product.minLevel) critical += 1;
      else if (qty <= product.reorderPoint) low += 1;
      else inStock += 1;
    }

    // Number of store rooms = root nodes of the STORE_ROOM type.
    const storeRooms = storeRoomCount.length
      ? await this.prisma.locationNode.count({ where: { locationTypeId: storeRoomCount[0].id } })
      : 0;

    return {
      products: products.length,
      shelves: shelfCount,
      storeRooms,
      suppliers: supplierCount,
      totalUnits,
      stockStatus: { inStock, low, critical, outOfStock },
      needsReorder: low + critical + outOfStock,
    };
  }
}
