import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../database/prisma.service';
import { computeStatus } from '../products/products.service';

export interface ReportColumn { header: string; key: string; width: number; align?: 'left' | 'right'; }
export interface ReportData { title: string; columns: ReportColumn[]; rows: Array<Record<string, string | number>>; }

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Data sets (English-only exports for MVP, §10) ----

  async stockOnHand(): Promise<ReportData> {
    const [products, positions, categories, units] = await Promise.all([
      this.prisma.product.findMany({ where: { isActive: true }, orderBy: { sku: 'asc' } }),
      this.prisma.stockPosition.findMany({ select: { productId: true, quantity: true } }),
      this.prisma.productCategory.findMany({ select: { id: true, nameEn: true } }),
      this.prisma.unitOfMeasure.findMany({ select: { id: true, code: true } }),
    ]);
    const qty = new Map<string, number>();
    for (const p of positions) qty.set(p.productId, (qty.get(p.productId) ?? 0) + p.quantity);
    const catName = new Map(categories.map((c) => [c.id, c.nameEn]));
    const unitCode = new Map(units.map((u) => [u.id, u.code]));
    return {
      title: 'Stock on Hand',
      columns: [
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'Product', key: 'name', width: 34 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'On hand', key: 'qty', width: 12, align: 'right' },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Reorder', key: 'reorder', width: 10, align: 'right' },
        { header: 'Status', key: 'status', width: 12 },
      ],
      rows: products.map((p) => {
        const q = qty.get(p.id) ?? 0;
        return { sku: p.sku, name: p.nameEn, category: catName.get(p.categoryId ?? '') ?? '', qty: q, unit: unitCode.get(p.baseUnitId) ?? '', reorder: p.reorderPoint, status: computeStatus(q, p.minLevel, p.reorderPoint) };
      }),
    };
  }

  async stockMovements(): Promise<ReportData> {
    const movements = await this.prisma.stockMovement.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    const productIds = [...new Set(movements.map((m) => m.productId))];
    const nodeIds = [...new Set(movements.flatMap((m) => [m.fromLocationNodeId, m.toLocationNodeId]).filter((v): v is string => Boolean(v)))];
    const userIds = [...new Set(movements.map((m) => m.userId))];
    const [products, nodes, users] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, sku: true } }),
      this.prisma.locationNode.findMany({ where: { id: { in: nodeIds } }, select: { id: true, designator: true } }),
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } }),
    ]);
    const sku = new Map(products.map((p) => [p.id, p.sku]));
    const des = new Map(nodes.map((n) => [n.id, n.designator]));
    const usr = new Map(users.map((u) => [u.id, u.displayName]));
    return {
      title: 'Stock Movements',
      columns: [
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Type', key: 'type', width: 14 },
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'From', key: 'from', width: 16 },
        { header: 'To', key: 'to', width: 16 },
        { header: 'Qty', key: 'qty', width: 8, align: 'right' },
        { header: 'By', key: 'by', width: 20 },
      ],
      rows: movements.map((m) => ({
        date: m.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        type: m.type,
        sku: sku.get(m.productId) ?? '—',
        from: m.fromLocationNodeId ? des.get(m.fromLocationNodeId) ?? '' : '',
        to: m.toLocationNodeId ? des.get(m.toLocationNodeId) ?? '' : '',
        qty: m.quantity,
        by: usr.get(m.userId) ?? '—',
      })),
    };
  }

  async replenishment(): Promise<ReportData> {
    const recs = await this.prisma.recommendation.findMany({ orderBy: { generatedAt: 'desc' }, take: 500 });
    const products = await this.prisma.product.findMany({ where: { id: { in: recs.map((r) => r.productId) } }, select: { id: true, sku: true, nameEn: true } });
    const p = new Map(products.map((x) => [x.id, x]));
    return {
      title: 'Replenishment',
      columns: [
        { header: 'Generated', key: 'generated', width: 20 },
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'Product', key: 'name', width: 32 },
        { header: 'Suggested', key: 'suggested', width: 12, align: 'right' },
        { header: 'Approved', key: 'approved', width: 12, align: 'right' },
        { header: 'Status', key: 'status', width: 12 },
      ],
      rows: recs.map((r) => ({
        generated: r.generatedAt.toISOString().slice(0, 16).replace('T', ' '),
        sku: p.get(r.productId)?.sku ?? '—',
        name: p.get(r.productId)?.nameEn ?? '—',
        suggested: r.suggestedQty,
        approved: r.approvedQty ?? '',
        status: r.status,
      })),
    };
  }

  // ---- Renderers ----

  async toXlsx(data: ReportData): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(data.title.slice(0, 31));
    ws.columns = data.columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    ws.getRow(1).font = { bold: true };
    for (const row of data.rows) ws.addRow(row);
    return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  }

  toPdf(data: ReportData): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fillColor('#0B4F5E').fontSize(18).font('Helvetica-Bold').text('MIZAN', 40, 36);
    doc.fillColor('#0D1B22').fontSize(13).text(data.title, 40, 58);
    doc.fillColor('#566A75').fontSize(8).font('Helvetica').text(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · Mizan`, 40, 76);

    const startX = 40;
    const totalWidth = data.columns.reduce((s, c) => s + c.width, 0);
    const scale = 760 / totalWidth; // fit A4 landscape content width
    const colX: number[] = [];
    let x = startX;
    for (const c of data.columns) { colX.push(x); x += c.width * scale; }

    let y = 100;
    const drawHeader = () => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#566A75');
      data.columns.forEach((c, i) => doc.text(c.header, colX[i], y, { width: c.width * scale - 4, align: c.align ?? 'left' }));
      doc.moveTo(startX, y + 12).lineTo(startX + 760, y + 12).strokeColor('#D6DEE2').stroke();
      y += 18;
    };
    drawHeader();
    doc.font('Helvetica').fontSize(8).fillColor('#0D1B22');
    for (const row of data.rows) {
      data.columns.forEach((c, i) => doc.text(String(row[c.key] ?? ''), colX[i], y, { width: c.width * scale - 4, align: c.align ?? 'left', ellipsis: true }));
      y += 15;
      if (y > 540) { doc.addPage(); y = 50; drawHeader(); doc.font('Helvetica').fontSize(8).fillColor('#0D1B22'); }
    }
    doc.fillColor('#8497A0').fontSize(7).text(`${data.rows.length} rows`, startX, y + 8);
    doc.end();
    return done;
  }
}
