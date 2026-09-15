import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import bwipjs from 'bwip-js';
import { PrismaService } from '../../database/prisma.service';

export interface LabelData {
  code: string;      // the barcode value (Code128)
  title: string;     // SKU or designator (mono, LTR)
  subtitle: string;  // product / location name
  png: string;       // data: URI of the rendered barcode
}

@Injectable()
export class BarcodeLabelsService {
  constructor(private readonly prisma: PrismaService) {}

  private async renderBarcode(text: string): Promise<string> {
    const png: Buffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text,
      scale: 3,
      height: 12,
      includetext: false,
      paddingwidth: 2,
      paddingheight: 2,
    });
    return 'data:image/png;base64,' + png.toString('base64');
  }

  async productLabels(ids: string[]): Promise<LabelData[]> {
    const products = await this.prisma.product.findMany({ where: { id: { in: ids } }, orderBy: { sku: 'asc' } });
    if (products.length === 0) throw new NotFoundException({ code: 'NO_LABELS', messageEn: 'No products found.', messageAr: 'لا توجد منتجات.' });
    return Promise.all(products.map(async (p) => ({
      code: p.barcode,
      title: p.sku,
      subtitle: p.nameEn,
      png: await this.renderBarcode(p.barcode),
    })));
  }

  async locationLabels(ids: string[]): Promise<LabelData[]> {
    const nodes = await this.prisma.locationNode.findMany({ where: { id: { in: ids } }, orderBy: { designator: 'asc' } });
    const withBarcode = nodes.filter((n) => n.barcode);
    if (withBarcode.length === 0) {
      throw new BadRequestException({ code: 'NO_BARCODE_LOCATIONS', messageEn: 'None of the selected locations carry a barcode.', messageAr: 'لا تحمل المواقع المختارة أي باركود.' });
    }
    return Promise.all(withBarcode.map(async (n) => ({
      code: n.barcode as string,
      title: n.designator,
      subtitle: n.nameEn ?? '',
      png: await this.renderBarcode(n.barcode as string),
    })));
  }

  /** All stock-holding shelves under a node (for "print a whole rack"). */
  async locationSubtreeShelfIds(nodeId: string): Promise<string[]> {
    const node = await this.prisma.locationNode.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundException({ code: 'LOCATION_NOT_FOUND', messageEn: 'Location not found.', messageAr: 'الموقع غير موجود.' });
    const subtree = await this.prisma.locationNode.findMany({
      where: { materialisedPath: { startsWith: node.materialisedPath }, barcode: { not: null } },
      select: { id: true },
    });
    return subtree.map((s) => s.id);
  }
}
