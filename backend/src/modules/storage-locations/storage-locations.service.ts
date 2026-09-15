import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreateNodeDto, BulkCreateDto, UpdateNodeDto } from './dto/location.schema';

export interface TreeNode {
  id: string;
  code: string;
  designator: string;
  depth: number;
  parentId: string | null;
  typeCode: string;
  typeNameEn: string;
  typeNameAr: string;
  canHoldStock: boolean;
  barcode: string | null;
  itemCount: number; // distinct products in subtree
  unitCount: number; // total units in subtree
  children: TreeNode[];
}

@Injectable()
export class StorageLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Full location tree with stock rolled up from stock-holding descendants. */
  async getTree(): Promise<TreeNode[]> {
    const [nodes, types, positions] = await Promise.all([
      this.prisma.locationNode.findMany({ where: { isActive: true }, orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }] }),
      this.prisma.locationType.findMany(),
      this.prisma.stockPosition.findMany({ select: { locationNodeId: true, productId: true, quantity: true } }),
    ]);
    const typeById = new Map(types.map((t) => [t.id, t]));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Attach each stock position's owning path for subtree rollups.
    const placed = positions
      .map((p) => ({ ...p, path: nodeById.get(p.locationNodeId)?.materialisedPath }))
      .filter((p): p is typeof p & { path: string } => Boolean(p.path));

    const inSubtree = (nodePath: string, posPath: string) => posPath === nodePath || posPath.startsWith(nodePath + '/');

    const build = (node: (typeof nodes)[number]): TreeNode => {
      const type = typeById.get(node.locationTypeId);
      const subtreePositions = placed.filter((p) => inSubtree(node.materialisedPath, p.path));
      const unitCount = subtreePositions.reduce((sum, p) => sum + p.quantity, 0);
      const itemCount = new Set(subtreePositions.map((p) => p.productId)).size;
      const children = nodes.filter((n) => n.parentId === node.id).map(build);
      return {
        id: node.id,
        code: node.code,
        designator: node.designator,
        depth: node.depth,
        parentId: node.parentId,
        typeCode: type?.code ?? '',
        typeNameEn: type?.nameEn ?? '',
        typeNameAr: type?.nameAr ?? '',
        canHoldStock: type?.canHoldStock ?? false,
        barcode: node.barcode,
        itemCount,
        unitCount,
        children,
      };
    };

    return nodes.filter((n) => n.parentId === null).map(build);
  }

  async getById(id: string) {
    const node = await this.prisma.locationNode.findUnique({ where: { id } });
    if (!node) throw new NotFoundException({ code: 'LOCATION_NOT_FOUND', messageEn: 'Location not found.', messageAr: 'الموقع غير موجود.' });
    return this.decorate(node.id);
  }

  async resolveByBarcode(barcode: string) {
    const node = await this.prisma.locationNode.findUnique({ where: { barcode } });
    if (!node) throw new NotFoundException({ code: 'BARCODE_NOT_FOUND', messageEn: 'No location with that barcode.', messageAr: 'لا يوجد موقع بهذا الباركود.' });
    return this.decorate(node.id);
  }

  /** A single location with its designator segments and the stock sitting on it. */
  private async decorate(nodeId: string) {
    const node = await this.prisma.locationNode.findUniqueOrThrow({ where: { id: nodeId } });
    const type = await this.prisma.locationType.findUnique({ where: { id: node.locationTypeId } });
    const stock = await this.stockAt(nodeId, false);
    return {
      id: node.id,
      code: node.code,
      designator: node.designator,
      segments: node.designator.split('-'),
      depth: node.depth,
      typeCode: type?.code ?? '',
      typeNameEn: type?.nameEn ?? '',
      typeNameAr: type?.nameAr ?? '',
      canHoldStock: type?.canHoldStock ?? false,
      barcode: node.barcode,
      itemCount: stock.length,
      unitCount: stock.reduce((sum, s) => sum + s.quantity, 0),
      stock,
    };
  }

  /** Stock at a node (optionally including descendant shelves), with product names. */
  async stockAt(nodeId: string, includeDescendants: boolean) {
    const node = await this.prisma.locationNode.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundException({ code: 'LOCATION_NOT_FOUND', messageEn: 'Location not found.', messageAr: 'الموقع غير موجود.' });

    let positions;
    if (includeDescendants) {
      const subtree = await this.prisma.locationNode.findMany({
        where: { materialisedPath: { startsWith: node.materialisedPath } },
        select: { id: true },
      });
      positions = await this.prisma.stockPosition.findMany({ where: { locationNodeId: { in: subtree.map((s) => s.id) } } });
    } else {
      positions = await this.prisma.stockPosition.findMany({ where: { locationNodeId: nodeId } });
    }
    if (positions.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: positions.map((p) => p.productId) } },
      select: { id: true, sku: true, nameEn: true, nameAr: true, barcode: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));
    return positions
      .map((p) => {
        const product = productById.get(p.productId);
        return {
          productId: p.productId,
          sku: product?.sku ?? '—',
          nameEn: product?.nameEn ?? '—',
          nameAr: product?.nameAr ?? '—',
          barcode: product?.barcode ?? null,
          quantity: p.quantity,
        };
      })
      .sort((a, b) => a.sku.localeCompare(b.sku));
  }

  // ---- Admin writes (§5A.3, §7) ----

  private designatorOf(parentDesignator: string, code: string): string {
    return parentDesignator ? `${parentDesignator}-${code}` : code;
  }

  async createNode(dto: CreateNodeDto, userId: string) {
    const parent = dto.parentId ? await this.prisma.locationNode.findUnique({ where: { id: dto.parentId } }) : null;
    if (dto.parentId && !parent) throw new NotFoundException({ code: 'PARENT_NOT_FOUND', messageEn: 'Parent location not found.', messageAr: 'الموقع الأصل غير موجود.' });
    const type = await this.prisma.locationType.findUnique({ where: { id: dto.locationTypeId } });
    if (!type) throw new NotFoundException({ code: 'TYPE_NOT_FOUND', messageEn: 'Location type not found.', messageAr: 'نوع الموقع غير موجود.' });

    const organizationId = parent?.organizationId ?? type.organizationId;
    await this.assertSiblingCodeFree(dto.parentId ?? null, dto.code);

    const designator = this.designatorOf(parent?.designator ?? '', dto.code);
    const node = await this.prisma.$transaction(async (tx) => {
      const created = await tx.locationNode.create({
        data: {
          organizationId,
          parentId: dto.parentId ?? null,
          locationTypeId: dto.locationTypeId,
          code: dto.code,
          nameEn: dto.nameEn ?? null,
          nameAr: dto.nameAr ?? null,
          designator,
          materialisedPath: `${parent?.materialisedPath ?? ''}/${dto.code}`,
          depth: (parent?.depth ?? -1) + 1,
          barcode: type.canHoldStock ? `LOC-${designator}` : null,
        },
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'LOCATION_CREATE', entityType: 'LocationNode', entityId: created.id, after: created as unknown as object } });
      return created;
    });
    return this.getById(node.id);
  }

  async updateNode(id: string, dto: UpdateNodeDto, userId: string) {
    const before = await this.prisma.locationNode.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: 'LOCATION_NOT_FOUND', messageEn: 'Location not found.', messageAr: 'الموقع غير موجود.' });
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.locationNode.update({ where: { id }, data: { nameEn: dto.nameEn, nameAr: dto.nameAr, isActive: dto.isActive } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'LOCATION_UPDATE', entityType: 'LocationNode', entityId: id, before: before as unknown as object, after: updated as unknown as object } });
    });
    return this.getById(id);
  }

  /**
   * Generate a subtree beneath a parent from level specs (§5A.3). With
   * preview=true it returns the designators to be created WITHOUT writing.
   */
  async bulkCreate(dto: BulkCreateDto, userId: string, preview: boolean) {
    const parent = dto.parentId ? await this.prisma.locationNode.findUnique({ where: { id: dto.parentId } }) : null;
    if (dto.parentId && !parent) throw new NotFoundException({ code: 'PARENT_NOT_FOUND', messageEn: 'Parent location not found.', messageAr: 'الموقع الأصل غير موجود.' });
    const types = await this.prisma.locationType.findMany({ where: { id: { in: dto.levels.map((l) => l.locationTypeId) } } });
    const typeById = new Map(types.map((t) => [t.id, t]));
    for (const level of dto.levels) {
      if (!typeById.has(level.locationTypeId)) throw new NotFoundException({ code: 'TYPE_NOT_FOUND', messageEn: 'Location type not found.', messageAr: 'نوع الموقع غير موجود.' });
    }
    const organizationId = parent?.organizationId ?? types[0]?.organizationId;

    interface Planned { code: string; designator: string; path: string; depth: number; typeId: string; canHoldStock: boolean; parentKey: string | null; realParentId: string | null; }
    let frontier: Array<{ tempKey: string | null; realId: string | null; designator: string; path: string; depth: number }> = [
      { tempKey: null, realId: parent?.id ?? null, designator: parent?.designator ?? '', path: parent?.materialisedPath ?? '', depth: parent?.depth ?? -1 },
    ];
    const planned: Planned[] = [];
    for (const level of dto.levels) {
      const type = typeById.get(level.locationTypeId)!;
      const next: typeof frontier = [];
      for (const node of frontier) {
        for (let i = level.from; i <= level.to; i++) {
          const code = `${level.prefix}${i}`;
          const designator = this.designatorOf(node.designator, code);
          const path = `${node.path}/${code}`;
          planned.push({ code, designator, path, depth: node.depth + 1, typeId: level.locationTypeId, canHoldStock: type.canHoldStock, parentKey: node.tempKey, realParentId: node.realId });
          next.push({ tempKey: designator, realId: null, designator, path, depth: node.depth + 1 });
        }
      }
      frontier = next;
    }

    if (preview) {
      return { count: planned.length, nodes: planned.map((p) => ({ designator: p.designator, code: p.code, depth: p.depth, canHoldStock: p.canHoldStock })) };
    }

    // Pre-generate ids so the whole subtree inserts in ONE query (fast), with
    // parent references resolved from the generated ids.
    const idByDesignator = new Map<string, string>(planned.map((p) => [p.designator, randomUUID()]));
    const data = planned.map((p) => ({
      id: idByDesignator.get(p.designator)!,
      organizationId,
      parentId: p.parentKey ? idByDesignator.get(p.parentKey)! : p.realParentId,
      locationTypeId: p.typeId,
      code: p.code,
      designator: p.designator,
      materialisedPath: p.path,
      depth: p.depth,
      barcode: p.canHoldStock ? `LOC-${p.designator}` : null,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.locationNode.createMany({ data });
      await tx.auditLog.create({ data: { actorId: userId, action: 'LOCATION_BULK_CREATE', entityType: 'LocationNode', entityId: parent?.id ?? 'root', after: { count: planned.length, parent: parent?.designator ?? null } } });
    });
    return { count: planned.length };
  }

  /**
   * Delete a location together with its whole subtree — a store room and its
   * empty racks/levels go in one action. Guarded so the tree and audit trail stay
   * intact (no FKs exist):
   *   • any actual stock anywhere in the subtree (units > 0) → refuse; the stock
   *     must be transferred to another location first;
   *   • no stock now but stock history (leftover position rows, movements or
   *     counts) → refuse; deactivate instead so the audit trail never dangles.
   * A never-used structure (0 units, no history) cascades cleanly.
   */
  async remove(id: string, userId: string) {
    const node = await this.prisma.locationNode.findUnique({ where: { id } });
    if (!node) throw new NotFoundException({ code: 'LOCATION_NOT_FOUND', messageEn: 'Location not found.', messageAr: 'الموقع غير موجود.' });

    // Collect the node and every descendant by walking parentId — robust whatever
    // the materialised-path scheme is, and unambiguous (no "/SR1" vs "/SR12").
    const all = await this.prisma.locationNode.findMany({ select: { id: true, parentId: true } });
    const childrenByParent = new Map<string, string[]>();
    for (const n of all) {
      if (!n.parentId) continue;
      const siblings = childrenByParent.get(n.parentId) ?? [];
      siblings.push(n.id);
      childrenByParent.set(n.parentId, siblings);
    }
    const subtreeIds: string[] = [];
    const stack = [id];
    while (stack.length) {
      const current = stack.pop()!;
      subtreeIds.push(current);
      for (const child of childrenByParent.get(current) ?? []) stack.push(child);
    }

    const [units, positionRows, movements, countLines] = await Promise.all([
      this.prisma.stockPosition.aggregate({ _sum: { quantity: true }, where: { locationNodeId: { in: subtreeIds } } }),
      this.prisma.stockPosition.count({ where: { locationNodeId: { in: subtreeIds } } }),
      this.prisma.stockMovement.count({ where: { OR: [{ fromLocationNodeId: { in: subtreeIds } }, { toLocationNodeId: { in: subtreeIds } }] } }),
      this.prisma.cycleCountLine.count({ where: { locationNodeId: { in: subtreeIds } } }),
    ]);

    if ((units._sum.quantity ?? 0) > 0) {
      throw new ConflictException({ code: 'LOCATION_HAS_STOCK', messageEn: 'This location still holds stock. Transfer it to another location first, then delete.', messageAr: 'لا يزال هذا الموقع يحتوي على رصيد. قم بنقله إلى موقع آخر أولاً ثم احذفه.' });
    }
    if (positionRows + movements + countLines > 0) {
      throw new ConflictException({ code: 'LOCATION_HAS_HISTORY', messageEn: 'This location has stock movement history and cannot be deleted. Deactivate it instead.', messageAr: 'لهذا الموقع سجل حركة مخزون ولا يمكن حذفه. قم بإلغاء تفعيله بدلاً من ذلك.' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.locationNode.deleteMany({ where: { id: { in: subtreeIds } } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'LOCATION_DELETE', entityType: 'LocationNode', entityId: id, before: { designator: node.designator, code: node.code, deletedCount: subtreeIds.length } } });
    });
    return { deleted: true, count: subtreeIds.length };
  }

  private async assertSiblingCodeFree(parentId: string | null, code: string) {
    const existing = await this.prisma.locationNode.findFirst({ where: { parentId, code } });
    if (existing) throw new ConflictException({ code: 'CODE_TAKEN', messageEn: `A location with code "${code}" already exists here.`, messageAr: `يوجد موقع بالرمز "${code}" هنا بالفعل.` });
  }
}
