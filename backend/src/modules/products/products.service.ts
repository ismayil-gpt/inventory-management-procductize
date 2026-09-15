import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.schema';

const IMPORT_HEADERS = ['sku', 'barcode', 'nameEn', 'nameAr', 'categoryCode', 'unitCode', 'packSize', 'reorderPoint', 'minLevel', 'maxLevel', 'supplierName'] as const;

export interface ImportRowResult {
  row: number;
  status: 'ok' | 'error';
  errors: string[];
  sku: string;
  nameEn: string;
}

export type StockStatus = 'IN_STOCK' | 'LOW' | 'CRITICAL' | 'OUT';

/** Stock state per §9.8: out (0), critical (<= min), low (<= reorder), else in stock. */
export function computeStatus(qty: number, minLevel: number, reorderPoint: number): StockStatus {
  if (qty <= 0) return 'OUT';
  if (qty <= minLevel) return 'CRITICAL';
  if (qty <= reorderPoint) return 'LOW';
  return 'IN_STOCK';
}

interface ProductFilters {
  search?: string;
  categoryId?: string;
  lowStock?: boolean;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private async lookups() {
    const [categories, units, suppliers, positions] = await Promise.all([
      this.prisma.productCategory.findMany({ select: { id: true, nameEn: true, nameAr: true } }),
      this.prisma.unitOfMeasure.findMany({ select: { id: true, code: true, nameEn: true, nameAr: true } }),
      this.prisma.supplier.findMany({ select: { id: true, name: true, leadTimeDays: true } }),
      this.prisma.stockPosition.findMany({ select: { productId: true, quantity: true } }),
    ]);
    const qtyByProduct = new Map<string, number>();
    for (const p of positions) qtyByProduct.set(p.productId, (qtyByProduct.get(p.productId) ?? 0) + p.quantity);
    return {
      categoryById: new Map(categories.map((c) => [c.id, c])),
      unitById: new Map(units.map((u) => [u.id, u])),
      supplierById: new Map(suppliers.map((s) => [s.id, s])),
      qtyByProduct,
    };
  }

  async list(filters: ProductFilters) {
    const { categoryById, unitById, supplierById, qtyByProduct } = await this.lookups();
    const products = await this.prisma.product.findMany({
      where: { isActive: true, ...(filters.categoryId ? { categoryId: filters.categoryId } : {}) },
      orderBy: { sku: 'asc' },
    });

    const search = filters.search?.trim().toLowerCase();
    const rows = products
      .map((p) => {
        const totalStock = qtyByProduct.get(p.id) ?? 0;
        const category = p.categoryId ? categoryById.get(p.categoryId) : undefined;
        const unit = unitById.get(p.baseUnitId);
        const supplier = p.supplierId ? supplierById.get(p.supplierId) : undefined;
        return {
          id: p.id,
          sku: p.sku,
          barcode: p.barcode,
          barcodeSource: p.barcodeSource,
          nameEn: p.nameEn,
          nameAr: p.nameAr,
          categoryId: p.categoryId,
          categoryNameEn: category?.nameEn ?? null,
          categoryNameAr: category?.nameAr ?? null,
          baseUnitCode: unit?.code ?? null,
          packSize: p.packSize,
          supplierId: p.supplierId,
          supplierName: supplier?.name ?? null,
          reorderPoint: p.reorderPoint,
          minLevel: p.minLevel,
          maxLevel: p.maxLevel,
          totalStock,
          status: computeStatus(totalStock, p.minLevel, p.reorderPoint),
        };
      })
      .filter((r) => {
        if (filters.lowStock && r.status === 'IN_STOCK') return false;
        if (search) {
          const hay = `${r.sku} ${r.nameEn} ${r.nameAr} ${r.barcode}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });

    return { total: rows.length, items: rows };
  }

  async getById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', messageEn: 'Product not found.', messageAr: 'المنتج غير موجود.' });
    const { categoryById, unitById, supplierById } = await this.lookups();
    const positions = await this.stockPositions(id);
    const totalStock = positions.reduce((sum, p) => sum + p.quantity, 0);
    const category = product.categoryId ? categoryById.get(product.categoryId) : undefined;
    const unit = unitById.get(product.baseUnitId);
    const supplier = product.supplierId ? supplierById.get(product.supplierId) : undefined;
    return {
      id: product.id,
      sku: product.sku,
      barcode: product.barcode,
      barcodeSource: product.barcodeSource,
      nameEn: product.nameEn,
      nameAr: product.nameAr,
      categoryId: product.categoryId,
      categoryNameEn: category?.nameEn ?? null,
      categoryNameAr: category?.nameAr ?? null,
      baseUnitCode: unit?.code ?? null,
      baseUnitNameEn: unit?.nameEn ?? null,
      packSize: product.packSize,
      supplierId: product.supplierId,
      supplierName: supplier?.name ?? null,
      supplierLeadTimeDays: supplier?.leadTimeDays ?? null,
      reorderPoint: product.reorderPoint,
      minLevel: product.minLevel,
      maxLevel: product.maxLevel,
      isActive: product.isActive,
      totalStock,
      status: computeStatus(totalStock, product.minLevel, product.reorderPoint),
      positions,
    };
  }

  /** Stock positions across locations, with the location designator resolved. */
  async stockPositions(productId: string) {
    const positions = await this.prisma.stockPosition.findMany({ where: { productId } });
    if (positions.length === 0) return [];
    const nodeIds = positions.map((p) => p.locationNodeId);
    const nodes = await this.prisma.locationNode.findMany({
      where: { id: { in: nodeIds } },
      select: { id: true, designator: true, barcode: true },
    });
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    return positions
      .map((p) => ({
        locationNodeId: p.locationNodeId,
        designator: nodeById.get(p.locationNodeId)?.designator ?? '—',
        barcode: nodeById.get(p.locationNodeId)?.barcode ?? null,
        quantity: p.quantity,
      }))
      .sort((a, b) => a.designator.localeCompare(b.designator));
  }

  async resolveByBarcode(barcode: string) {
    const product = await this.prisma.product.findUnique({ where: { barcode } });
    if (!product) throw new NotFoundException({ code: 'BARCODE_NOT_FOUND', messageEn: 'No product with that barcode.', messageAr: 'لا يوجد منتج بهذا الباركود.' });
    return this.getById(product.id);
  }

  // ---- Admin writes (§7 POST/PATCH /products) ----

  async create(dto: CreateProductDto, userId: string) {
    const organizationId = await this.organizationId();
    await this.assertSkuFree(organizationId, dto.sku);

    const hasBarcode = Boolean(dto.barcode && dto.barcode.trim());
    if (hasBarcode) await this.assertBarcodeFree(dto.barcode!.trim());
    if (dto.minLevel > dto.maxLevel) throw this.badLevels();

    const barcode = hasBarcode ? dto.barcode!.trim() : await this.generateInternalBarcode();

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          organizationId,
          sku: dto.sku,
          barcode,
          barcodeSource: hasBarcode ? 'MANUFACTURER' : 'INTERNAL',
          nameEn: dto.nameEn,
          nameAr: dto.nameAr,
          categoryId: dto.categoryId ?? null,
          baseUnitId: dto.baseUnitId,
          packSize: dto.packSize,
          reorderPoint: dto.reorderPoint,
          minLevel: dto.minLevel,
          maxLevel: dto.maxLevel,
          supplierId: dto.supplierId ?? null,
          isActive: dto.isActive,
        },
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'PRODUCT_CREATE', entityType: 'Product', entityId: created.id, after: created as unknown as object } });
      return created;
    });
    return this.getById(product.id);
  }

  async update(id: string, dto: UpdateProductDto, userId: string) {
    const before = await this.prisma.product.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', messageEn: 'Product not found.', messageAr: 'المنتج غير موجود.' });

    if (dto.sku && dto.sku !== before.sku) await this.assertSkuFree(before.organizationId, dto.sku, id);
    if (dto.barcode && dto.barcode.trim() !== before.barcode) await this.assertBarcodeFree(dto.barcode.trim(), id);
    const nextMin = dto.minLevel ?? before.minLevel;
    const nextMax = dto.maxLevel ?? before.maxLevel;
    if (nextMin > nextMax) throw this.badLevels();

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          sku: dto.sku,
          barcode: dto.barcode?.trim(),
          nameEn: dto.nameEn,
          nameAr: dto.nameAr,
          categoryId: dto.categoryId === undefined ? undefined : dto.categoryId,
          baseUnitId: dto.baseUnitId,
          packSize: dto.packSize,
          reorderPoint: dto.reorderPoint,
          minLevel: dto.minLevel,
          maxLevel: dto.maxLevel,
          supplierId: dto.supplierId === undefined ? undefined : dto.supplierId,
          isActive: dto.isActive,
        },
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'PRODUCT_UPDATE', entityType: 'Product', entityId: id, before: before as unknown as object, after: updated as unknown as object } });
    });
    return this.getById(id);
  }

  /**
   * Hard-delete a product, but ONLY when it has never been used — no stock
   * position, movement, recommendation or count line references it. Anything with
   * history must be deactivated instead so records never dangle (no FKs exist).
   */
  async remove(id: string, userId: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', messageEn: 'Product not found.', messageAr: 'المنتج غير موجود.' });

    const [positions, movements, recommendations, countLines] = await Promise.all([
      this.prisma.stockPosition.count({ where: { productId: id } }),
      this.prisma.stockMovement.count({ where: { productId: id } }),
      this.prisma.recommendation.count({ where: { productId: id } }),
      this.prisma.cycleCountLine.count({ where: { productId: id } }),
    ]);
    if (positions + movements + recommendations + countLines > 0) {
      throw new ConflictException({ code: 'PRODUCT_HAS_HISTORY', messageEn: 'This product has stock or movement history and cannot be deleted. Deactivate it instead.', messageAr: 'لهذا المنتج رصيد أو سجل حركة ولا يمكن حذفه. قم بإلغاء تفعيله بدلاً من ذلك.' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.delete({ where: { id } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'PRODUCT_DELETE', entityType: 'Product', entityId: id, before: product as unknown as object } });
    });
    return { deleted: true };
  }

  private async organizationId(): Promise<string> {
    const org = await this.prisma.organization.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    if (!org) throw new NotFoundException({ code: 'NO_ORGANIZATION', messageEn: 'No organization configured.', messageAr: 'لا توجد مؤسسة مهيأة.' });
    return org.id;
  }

  private async assertSkuFree(organizationId: string, sku: string, exceptId?: string) {
    const existing = await this.prisma.product.findUnique({ where: { organizationId_sku: { organizationId, sku } } });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException({ code: 'SKU_TAKEN', messageEn: `SKU "${sku}" is already in use.`, messageAr: `الرمز "${sku}" مستخدم بالفعل.` });
    }
  }

  private async assertBarcodeFree(barcode: string, exceptId?: string) {
    const existing = await this.prisma.product.findUnique({ where: { barcode } });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException({ code: 'BARCODE_TAKEN', messageEn: `Barcode "${barcode}" is already in use.`, messageAr: `الباركود "${barcode}" مستخدم بالفعل.` });
    }
  }

  private badLevels() {
    return new ConflictException({ code: 'INVALID_LEVELS', messageEn: 'Minimum level cannot exceed maximum level.', messageAr: 'لا يمكن أن يتجاوز الحد الأدنى الحد الأقصى.' });
  }

  /** Generate a unique internal barcode (INT-#########), retrying on collision. */
  private async generateInternalBarcode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = 'INT-' + Math.floor(100000000 + Math.random() * 899999999).toString();
      const clash = await this.prisma.product.findUnique({ where: { barcode: candidate } });
      if (!clash) return candidate;
    }
    throw new ConflictException({ code: 'BARCODE_GEN_FAILED', messageEn: 'Could not generate a unique barcode.', messageAr: 'تعذّر توليد باركود فريد.' });
  }

  // ---- Excel import (§5A.4, §7) ----

  async importTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');
    ws.addRow([...IMPORT_HEADERS]);
    ws.getRow(1).font = { bold: true };
    ws.addRow(['PRD-1001', '', 'Example Product', 'منتج مثال', 'CAT-HOTBEV', 'BOX', 1, 20, 10, 80, 'Emirates Pantry Distribution']);
    ws.columns.forEach((c) => (c.width = 18));
    return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  }

  /**
   * Validate an uploaded workbook row-by-row. On dryRun it only reports; on
   * commit it imports ONLY if every row is valid (never a partial import, §5A.4).
   */
  async importProducts(buffer: Buffer, dryRun: boolean, userId: string) {
    const wb = new ExcelJS.Workbook();
    // Node Buffer vs exceljs Buffer typing differs; runtime accepts the Node Buffer.
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new ConflictException({ code: 'EMPTY_FILE', messageEn: 'The file has no worksheet.', messageAr: 'الملف لا يحتوي على ورقة عمل.' });

    // Map headers (case-insensitive) → column index.
    const headerIndex: Record<string, number> = {};
    ws.getRow(1).eachCell((cell, col) => { headerIndex[String(cell.value ?? '').trim().toLowerCase()] = col; });
    const cell = (row: ExcelJS.Row, key: string) => {
      const idx = headerIndex[key.toLowerCase()];
      if (!idx) return undefined;
      const v = row.getCell(idx).value;
      return v === null || v === undefined ? undefined : (typeof v === 'object' && 'text' in v ? (v as { text: string }).text : v);
    };
    const asInt = (v: unknown) => { const n = Number(v); return Number.isInteger(n) ? n : NaN; };

    const organizationId = await this.organizationId();
    const [categories, units, suppliers, existingProducts] = await Promise.all([
      this.prisma.productCategory.findMany({ where: { organizationId }, select: { id: true, code: true } }),
      this.prisma.unitOfMeasure.findMany({ where: { organizationId }, select: { id: true, code: true } }),
      this.prisma.supplier.findMany({ select: { id: true, name: true } }),
      this.prisma.product.findMany({ where: { organizationId }, select: { sku: true, barcode: true } }),
    ]);
    const catByCode = new Map(categories.map((c) => [c.code.toLowerCase(), c.id]));
    const unitByCode = new Map(units.map((u) => [u.code.toLowerCase(), u.id]));
    const supByName = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]));
    const existingSkus = new Set(existingProducts.map((p) => p.sku.toLowerCase()));
    const existingBarcodes = new Set(existingProducts.map((p) => p.barcode));

    const seenSkus = new Set<string>();
    const seenBarcodes = new Set<string>();
    const results: ImportRowResult[] = [];
    const valid: Array<Record<string, unknown>> = [];

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const sku = String(cell(row, 'sku') ?? '').trim();
      const nameEn = String(cell(row, 'nameEn') ?? '').trim();
      // Skip fully-empty rows.
      if (!sku && !nameEn && !cell(row, 'nameAr')) return;

      const errors: string[] = [];
      const nameAr = String(cell(row, 'nameAr') ?? '').trim();
      const barcodeRaw = String(cell(row, 'barcode') ?? '').trim();
      const unitCode = String(cell(row, 'unitCode') ?? '').trim();
      const categoryCode = String(cell(row, 'categoryCode') ?? '').trim();
      const supplierName = String(cell(row, 'supplierName') ?? '').trim();
      const packSize = cell(row, 'packSize') === undefined ? 1 : asInt(cell(row, 'packSize'));
      const reorderPoint = asInt(cell(row, 'reorderPoint'));
      const minLevel = asInt(cell(row, 'minLevel'));
      const maxLevel = asInt(cell(row, 'maxLevel'));

      if (!sku) errors.push('SKU is required.');
      else if (existingSkus.has(sku.toLowerCase()) || seenSkus.has(sku.toLowerCase())) errors.push(`SKU "${sku}" already exists.`);
      if (!nameEn) errors.push('Name (EN) is required.');
      if (!nameAr) errors.push('Name (AR) is required.');
      const baseUnitId = unitByCode.get(unitCode.toLowerCase());
      if (!unitCode) errors.push('Unit code is required.');
      else if (!baseUnitId) errors.push(`Unknown unit code "${unitCode}".`);
      let categoryId: string | null = null;
      if (categoryCode) { categoryId = catByCode.get(categoryCode.toLowerCase()) ?? null; if (!categoryId) errors.push(`Unknown category code "${categoryCode}".`); }
      let supplierId: string | null = null;
      if (supplierName) { supplierId = supByName.get(supplierName.toLowerCase()) ?? null; if (!supplierId) errors.push(`Unknown supplier "${supplierName}".`); }
      if (Number.isNaN(reorderPoint) || reorderPoint < 0) errors.push('Reorder point must be a number ≥ 0.');
      if (Number.isNaN(minLevel) || minLevel < 0) errors.push('Min level must be a number ≥ 0.');
      if (Number.isNaN(maxLevel) || maxLevel < 1) errors.push('Max level must be a number ≥ 1.');
      if (!Number.isNaN(minLevel) && !Number.isNaN(maxLevel) && minLevel > maxLevel) errors.push('Min level cannot exceed max level.');
      if (Number.isNaN(packSize) || packSize < 1) errors.push('Pack size must be a number ≥ 1.');
      if (barcodeRaw) {
        if (existingBarcodes.has(barcodeRaw) || seenBarcodes.has(barcodeRaw)) errors.push(`Barcode "${barcodeRaw}" already exists.`);
        seenBarcodes.add(barcodeRaw);
      }
      if (sku) seenSkus.add(sku.toLowerCase());

      results.push({ row: rowNumber, status: errors.length ? 'error' : 'ok', errors, sku, nameEn });
      if (errors.length === 0) {
        valid.push({ organizationId, sku, barcode: barcodeRaw || null, nameEn, nameAr, categoryId, baseUnitId, packSize, reorderPoint, minLevel, maxLevel, supplierId });
      }
    });

    const summary = { total: results.length, valid: valid.length, invalid: results.filter((r) => r.status === 'error').length };

    if (dryRun || summary.invalid > 0) {
      return { dryRun: true, imported: 0, summary, rows: results };
    }

    // Commit — all rows valid.
    await this.prisma.$transaction(async (tx) => {
      for (const v of valid) {
        const barcode = (v.barcode as string | null) ?? await this.generateInternalBarcode();
        await tx.product.create({
          data: {
            organizationId: v.organizationId as string, sku: v.sku as string, barcode,
            barcodeSource: v.barcode ? 'MANUFACTURER' : 'INTERNAL',
            nameEn: v.nameEn as string, nameAr: v.nameAr as string,
            categoryId: v.categoryId as string | null, baseUnitId: v.baseUnitId as string,
            packSize: v.packSize as number, reorderPoint: v.reorderPoint as number,
            minLevel: v.minLevel as number, maxLevel: v.maxLevel as number, supplierId: v.supplierId as string | null,
          },
        });
      }
      await tx.auditLog.create({ data: { actorId: userId, action: 'PRODUCT_IMPORT', entityType: 'Product', entityId: 'batch', after: { imported: valid.length } } });
    });
    return { dryRun: false, imported: valid.length, summary, rows: results };
  }
}
