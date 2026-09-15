import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { Supplier } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../email/email.service';

interface PoLine { sku: string; name: string; qty: number; unit: string; }

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService, private readonly email: EmailService) {}

  /**
   * Turn approved/amended recommendations into purchase orders — one per supplier
   * per run (§12 r7) — then email each supplier a PDF. Recommendations become
   * ORDERED and are linked to their PO.
   */
  async generateFromApproved(userId: string) {
    const recs = await this.prisma.recommendation.findMany({ where: { status: { in: ['APPROVED', 'AMENDED'] }, purchaseOrderId: null } });
    if (recs.length === 0) return { created: [], skippedNoSupplier: 0 };

    const products = await this.prisma.product.findMany({ where: { id: { in: recs.map((r) => r.productId) } } });
    const productById = new Map(products.map((p) => [p.id, p]));

    // Group by supplier; recommendations without a supplier cannot be ordered.
    const bySupplier = new Map<string, typeof recs>();
    let skippedNoSupplier = 0;
    for (const rec of recs) {
      const supplierId = productById.get(rec.productId)?.supplierId;
      if (!supplierId) { skippedNoSupplier += 1; continue; }
      const list = bySupplier.get(supplierId) ?? [];
      list.push(rec);
      bySupplier.set(supplierId, list);
    }

    const year = new Date().getFullYear();
    let sequence = await this.prisma.purchaseOrder.count();
    const created: Array<{ id: string; poNumber: string; supplierName: string; lineCount: number; emailed: boolean }> = [];

    for (const [supplierId, group] of bySupplier) {
      const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) continue;
      sequence += 1;
      const poNumber = `PO-${year}-${String(sequence).padStart(4, '0')}`;

      const po = await this.prisma.$transaction(async (tx) => {
        const createdPo = await tx.purchaseOrder.create({ data: { poNumber, supplierId, status: 'DRAFT' } });
        for (const rec of group) {
          await tx.recommendation.update({ where: { id: rec.id }, data: { status: 'ORDERED', purchaseOrderId: createdPo.id } });
        }
        await tx.auditLog.create({ data: { actorId: userId, action: 'PURCHASE_ORDER_CREATE', entityType: 'PurchaseOrder', entityId: createdPo.id, after: { poNumber, supplierId, lines: group.length } } });
        return createdPo;
      });

      const pdf = await this.buildPdf(po.poNumber, po.createdAt, supplier, this.linesFor(group, productById));
      const subject = `Purchase Order ${poNumber}`;
      const body = `Dear ${supplier.name},\n\nPlease find attached purchase order ${poNumber}.\n\nRegards,\nMizan Inventory`;
      const result = await this.email.send(supplier.email, subject, body, [{ filename: `${poNumber}.pdf`, content: pdf, contentType: 'application/pdf' }]);

      if (result.sent) {
        await this.prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'SENT', sentAt: new Date() } });
      }
      created.push({ id: po.id, poNumber, supplierName: supplier.name, lineCount: group.length, emailed: result.sent });
    }

    return { created, skippedNoSupplier };
  }

  async list() {
    const pos = await this.prisma.purchaseOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    const supplierIds = [...new Set(pos.map((p) => p.supplierId))];
    const suppliers = await this.prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } });
    const supplierById = new Map(suppliers.map((s) => [s.id, s]));
    const counts = await this.prisma.recommendation.groupBy({ by: ['purchaseOrderId'], where: { purchaseOrderId: { in: pos.map((p) => p.id) } }, _count: { _all: true }, _sum: { approvedQty: true } });
    const countByPo = new Map(counts.map((c) => [c.purchaseOrderId, c]));
    return pos.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      supplierName: supplierById.get(po.supplierId)?.name ?? '—',
      status: po.status,
      lineCount: countByPo.get(po.id)?._count._all ?? 0,
      totalQty: countByPo.get(po.id)?._sum.approvedQty ?? 0,
      sentAt: po.sentAt,
      createdAt: po.createdAt,
    }));
  }

  async pdf(id: string): Promise<{ buffer: Buffer; poNumber: string }> {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundException({ code: 'PO_NOT_FOUND', messageEn: 'Purchase order not found.', messageAr: 'أمر الشراء غير موجود.' });
    const supplier = await this.prisma.supplier.findUniqueOrThrow({ where: { id: po.supplierId } });
    const recs = await this.prisma.recommendation.findMany({ where: { purchaseOrderId: id } });
    const products = await this.prisma.product.findMany({ where: { id: { in: recs.map((r) => r.productId) } } });
    const productById = new Map(products.map((p) => [p.id, p]));
    const buffer = await this.buildPdf(po.poNumber, po.createdAt, supplier, this.linesFor(recs, productById));
    return { buffer, poNumber: po.poNumber };
  }

  private linesFor(recs: Array<{ productId: string; approvedQty: number | null; suggestedQty: number }>, productById: Map<string, { sku: string; nameEn: string; baseUnitId: string }>): PoLine[] {
    return recs.map((r) => {
      const p = productById.get(r.productId);
      return { sku: p?.sku ?? '—', name: p?.nameEn ?? '—', qty: r.approvedQty ?? r.suggestedQty, unit: '' };
    });
  }

  /** English-only PDF for MVP (§10). */
  private buildPdf(poNumber: string, createdAt: Date, supplier: Supplier, lines: PoLine[]): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const teal = '#0B4F5E';
    doc.fillColor(teal).fontSize(22).font('Helvetica-Bold').text('MIZAN', 50, 50);
    doc.fillColor('#A67C1A').rect(50, 78, 120, 2).fill();
    doc.fillColor('#566A75').fontSize(9).font('Helvetica').text('Inventory', 50, 84);

    doc.fillColor('#0D1B22').fontSize(16).font('Helvetica-Bold').text('PURCHASE ORDER', 50, 120);
    doc.fontSize(10).font('Helvetica').fillColor('#0D1B22');
    doc.text(`PO Number: ${poNumber}`, 50, 150);
    doc.text(`Date: ${createdAt.toISOString().slice(0, 10)}`, 50, 165);

    doc.font('Helvetica-Bold').text('Supplier', 50, 195);
    doc.font('Helvetica').text(supplier.name, 50, 210);
    doc.text(supplier.email, 50, 224);
    doc.text(`Lead time: ${supplier.leadTimeDays} days`, 50, 238);

    // Table header
    let y = 280;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#566A75');
    doc.text('SKU', 50, y).text('PRODUCT', 150, y).text('QTY', 470, y, { width: 70, align: 'right' });
    doc.moveTo(50, y + 14).lineTo(545, y + 14).strokeColor('#D6DEE2').stroke();
    y += 22;

    doc.font('Helvetica').fontSize(10).fillColor('#0D1B22');
    let totalQty = 0;
    for (const line of lines) {
      doc.text(line.sku, 50, y).text(line.name, 150, y, { width: 300 }).text(String(line.qty), 470, y, { width: 70, align: 'right' });
      totalQty += line.qty;
      y += 20;
      if (y > 760) { doc.addPage(); y = 60; }
    }
    doc.moveTo(50, y + 4).lineTo(545, y + 4).strokeColor('#D6DEE2').stroke();
    doc.font('Helvetica-Bold').text(`Total items: ${lines.length}`, 50, y + 12).text(`Total qty: ${totalQty}`, 470, y + 12, { width: 70, align: 'right' });

    doc.fontSize(8).fillColor('#8497A0').font('Helvetica').text('Generated by Mizan — this order requires no signature.', 50, 800, { align: 'center', width: 495 });

    doc.end();
    return done;
  }
}
