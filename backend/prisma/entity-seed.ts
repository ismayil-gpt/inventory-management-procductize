// backend/prisma/entity-seed.ts
// Parameterised seed for standing up a NEW entity (customer/prospect) deployment.
// Driven entirely by environment variables so it works for any organisation with
// no code change (CLAUDE.md §5A). Normally invoked by scripts/create-entity.ps1,
// but can be run directly:
//   $env:DATABASE_URL='postgresql://mizan:...@localhost:5432/acme_demo'
//   $env:ENTITY_CODE='ACME'; $env:ENTITY_NAME_EN='Acme Distribution'; $env:ENTITY_SAMPLE='true'
//   npx tsx prisma/entity-seed.ts
//
// Seeds: the organisation, a sensible default hierarchy, base units, and an
// admin + store keeper. With ENTITY_SAMPLE=true it also loads a small, neutral
// sample catalogue so the deployment looks alive on first login.
import { PrismaClient, Prisma, Role, MovementType } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import { calculateReorder } from '../src/modules/replenishment/reorder-calculator';
import { generateReasoning } from '../src/modules/replenishment/reasoning-generator';

const prisma = new PrismaClient();

// Deterministic PRNG so the sample (and its recommendations) are reproducible.
let _seed = 20260806;
const rnd = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; };

const env = (k: string, fallback = '') => (process.env[k] ?? fallback).trim();
const CODE = env('ENTITY_CODE').toUpperCase();
const NAME_EN = env('ENTITY_NAME_EN');
const NAME_AR = env('ENTITY_NAME_AR') || NAME_EN;
const SAMPLE = env('ENTITY_SAMPLE').toLowerCase() === 'true';
const codeLower = CODE.toLowerCase();
const titleCode = CODE.charAt(0) + CODE.slice(1).toLowerCase();
const ADMIN_EMAIL = env('ENTITY_ADMIN_EMAIL') || `admin@${codeLower}.demo`;
const ADMIN_PASSWORD = env('ENTITY_ADMIN_PASSWORD') || `Admin@${titleCode}2026`;
const KEEPER_EMAIL = env('ENTITY_STOREKEEPER_EMAIL') || `storekeeper@${codeLower}.demo`;
const KEEPER_PASSWORD = env('ENTITY_STOREKEEPER_PASSWORD') || `Store@${titleCode}2026`;

async function main() {
  if (!CODE || !NAME_EN) {
    throw new Error('ENTITY_CODE and ENTITY_NAME_EN are required.');
  }

  // Fresh DB, but keep it idempotent.
  await prisma.stockMovement.deleteMany().catch(() => undefined);
  await prisma.recommendation.deleteMany();
  await prisma.stockPosition.deleteMany();
  await prisma.product.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.unitOfMeasure.deleteMany();
  await prisma.productAttributeDefinition.deleteMany();
  await prisma.locationNode.deleteMany();
  await prisma.locationType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: { code: CODE, nameEn: NAME_EN, nameAr: NAME_AR, timezone: 'Asia/Dubai', defaultLanguage: 'en' },
  });
  const organizationId = org.id;

  // Default hierarchy: Warehouse > Aisle > Shelf. Fully reconfigurable in-app.
  const types = [
    { code: 'WAREHOUSE', nameEn: 'Warehouse', nameAr: 'مستودع', depth: 0, hold: false },
    { code: 'AISLE', nameEn: 'Aisle', nameAr: 'ممر', depth: 1, hold: false },
    { code: 'SHELF', nameEn: 'Shelf', nameAr: 'رف', depth: 2, hold: true },
  ];
  const typeByCode: Record<string, string> = {};
  for (const t of types) { const c = await prisma.locationType.create({ data: { organizationId, code: t.code, nameEn: t.nameEn, nameAr: t.nameAr, depth: t.depth, canHoldStock: t.hold, sortOrder: t.depth } }); typeByCode[t.code] = c.id; }

  // Base units of measure.
  const units = [
    { code: 'PIECE', nameEn: 'Piece', nameAr: 'قطعة', base: true },
    { code: 'BOX', nameEn: 'Box', nameAr: 'علبة' },
    { code: 'CARTON', nameEn: 'Carton', nameAr: 'كرتون' },
    { code: 'PACK', nameEn: 'Pack', nameAr: 'عبوة' },
    { code: 'KG', nameEn: 'Kilogram', nameAr: 'كيلوغرام' },
  ];
  const unitByCode: Record<string, string> = {};
  for (const u of units) { const c = await prisma.unitOfMeasure.create({ data: { organizationId, code: u.code, nameEn: u.nameEn, nameAr: u.nameAr, isBaseUnit: Boolean(u.base) } }); unitByCode[u.code] = c.id; }

  // Two demo users.
  let keeperId = '';
  for (const u of [
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, displayName: 'Administrator', role: Role.ADMIN },
    { email: KEEPER_EMAIL, password: KEEPER_PASSWORD, displayName: 'Store Keeper', role: Role.STORE_KEEPER },
  ]) {
    const created = await prisma.user.create({ data: { email: u.email.toLowerCase(), passwordHash: await hash(u.password), displayName: u.displayName, role: u.role, preferredLanguage: 'en' } });
    if (u.role === Role.STORE_KEEPER) keeperId = created.id;
  }

  let productCount = 0, shelfCount = 0, recCount = 0;

  if (SAMPLE) {
    // Neutral sample catalogue — plausible warehouse/office stock, tied to no real client.
    const categories = [
      { code: 'CAT-GENERAL', nameEn: 'General Supplies', nameAr: 'لوازم عامة' },
      { code: 'CAT-CONSUM', nameEn: 'Consumables', nameAr: 'مستهلكات' },
      { code: 'CAT-SAFETY', nameEn: 'Safety', nameAr: 'السلامة' },
    ];
    const catByCode: Record<string, string> = {};
    for (const c of categories) { const created = await prisma.productCategory.create({ data: { organizationId, code: c.code, nameEn: c.nameEn, nameAr: c.nameAr, materialisedPath: `/${c.code}`, sortOrder: 0 } }); catByCode[c.code] = created.id; }

    const supplier = await prisma.supplier.create({ data: { name: 'Sample Supplier Co.', email: 'orders@sample-supplier.example', leadTimeDays: 4 } });

    // Location tree: 1 warehouse x 2 aisles x 3 shelves = 6 shelves.
    const nodeIdByDesignator: Record<string, string> = {};
    const locs: Array<{ code: string; designator: string; depth: number; typeCode: string; parent: string; barcode: string | null }> = [];
    locs.push({ code: 'W1', designator: 'W1', depth: 0, typeCode: 'WAREHOUSE', parent: '', barcode: null });
    for (let a = 1; a <= 2; a++) {
      const aDes = `W1-A${a}`;
      locs.push({ code: `A${a}`, designator: aDes, depth: 1, typeCode: 'AISLE', parent: 'W1', barcode: null });
      for (let s = 1; s <= 3; s++) {
        const sDes = `${aDes}-S${s}`;
        locs.push({ code: `S${s}`, designator: sDes, depth: 2, typeCode: 'SHELF', parent: aDes, barcode: `LOC-${sDes}` });
      }
    }
    for (const n of locs) {
      const created = await prisma.locationNode.create({
        data: { organizationId, parentId: n.parent ? nodeIdByDesignator[n.parent] : null, locationTypeId: typeByCode[n.typeCode], code: n.code, designator: n.designator, materialisedPath: '/' + n.designator.split('-').join('/'), depth: n.depth, barcode: n.barcode },
      });
      nodeIdByDesignator[n.designator] = created.id;
    }
    const shelves = locs.filter((l) => l.typeCode === 'SHELF').map((l) => l.designator);
    shelfCount = shelves.length;

    let bc = 6290000000000;
    const B = () => String(++bc);
    const products = [
      { sku: 'GEN-A4PAPER', nameEn: 'A4 Paper Ream 80gsm', nameAr: 'ورق A4 ٨٠غ', cat: 'CAT-GENERAL', unit: 'CARTON', reorder: 30, min: 15, max: 120, cost: 58.50 },
      { sku: 'GEN-PENS', nameEn: 'Ballpoint Pens (Box of 50)', nameAr: 'أقلام حبر (علبة ٥٠)', cat: 'CAT-GENERAL', unit: 'BOX', reorder: 20, min: 10, max: 80, cost: 17.40 },
      { sku: 'GEN-MARKERS', nameEn: 'Marker Set (4 colours)', nameAr: 'طقم أقلام تحديد (٤ ألوان)', cat: 'CAT-GENERAL', unit: 'PACK', reorder: 15, min: 8, max: 60, cost: 13.20 },
      { sku: 'GEN-STAPLER', nameEn: 'Stapler Heavy Duty', nameAr: 'دبّاسة خدمة شاقة', cat: 'CAT-GENERAL', unit: 'PIECE', reorder: 10, min: 5, max: 40, cost: 34.90 },
      { sku: 'CON-SANITIZER', nameEn: 'Hand Sanitizer 500ml', nameAr: 'معقّم يدين ٥٠٠مل', cat: 'CAT-CONSUM', unit: 'PIECE', reorder: 30, min: 15, max: 120, cost: 13.80 },
      { sku: 'CON-WIPES', nameEn: 'Cleaning Wipes (80s)', nameAr: 'مناديل تنظيف (٨٠)', cat: 'CAT-CONSUM', unit: 'BOX', reorder: 25, min: 12, max: 100, cost: 12.60 },
      { sku: 'CON-TRASHBAG', nameEn: 'Trash Bags (Roll of 50)', nameAr: 'أكياس قمامة (لفة ٥٠)', cat: 'CAT-CONSUM', unit: 'PACK', reorder: 30, min: 15, max: 120, cost: 15.90 },
      { sku: 'CON-WATER', nameEn: 'Bottled Water 500ml (24s)', nameAr: 'مياه معبأة ٥٠٠مل (٢٤)', cat: 'CAT-CONSUM', unit: 'CARTON', reorder: 40, min: 20, max: 160, cost: 9.60 },
      { sku: 'CON-COFFEE', nameEn: 'Instant Coffee 200g', nameAr: 'قهوة سريعة التحضير ٢٠٠غ', cat: 'CAT-CONSUM', unit: 'BOX', reorder: 15, min: 8, max: 60, cost: 21.70 },
      { sku: 'CON-BATTAA', nameEn: 'AA Batteries (Pack of 10)', nameAr: 'بطاريات AA (عبوة ١٠)', cat: 'CAT-CONSUM', unit: 'PACK', reorder: 25, min: 12, max: 100, cost: 19.30 },
      { sku: 'SAF-GLOVES', nameEn: 'Nitrile Gloves (Box of 100)', nameAr: 'قفازات نتريل (علبة ١٠٠)', cat: 'CAT-SAFETY', unit: 'BOX', reorder: 30, min: 15, max: 120, cost: 28.40 },
      { sku: 'SAF-FIRSTAID', nameEn: 'First Aid Kit', nameAr: 'حقيبة إسعافات أولية', cat: 'CAT-SAFETY', unit: 'PIECE', reorder: 10, min: 5, max: 40, cost: 89.00 },
    ];
    const idBySku: Record<string, string> = {};
    for (const p of products) {
      const created = await prisma.product.create({
        data: { organizationId, sku: p.sku, barcode: B(), barcodeSource: 'MANUFACTURER', nameEn: p.nameEn, nameAr: p.nameAr, categoryId: catByCode[p.cat], baseUnitId: unitByCode[p.unit], packSize: 1, reorderPoint: p.reorder, minLevel: p.min, maxLevel: p.max, supplierId: supplier.id, unitCost: p.cost },
      });
      idBySku[p.sku] = created.id;
      productCount++;
    }
    // Spread stock across shelves; ~half deliberately at/below reorder so the
    // Replenishment screen looks realistically busy for the demo.
    for (let i = 0; i < products.length; i++) {
      const shelf = shelves[i % shelves.length];
      const p = products[i];
      let qty: number;
      if (i % 4 === 0) qty = Math.max(1, Math.floor(p.min * 0.6));         // critical (<= min)
      else if (i % 4 === 2) qty = Math.max(p.min + 1, p.reorder - 1);      // low (<= reorder)
      else qty = p.reorder + Math.ceil((p.max - p.reorder) * 0.55);         // healthy
      await prisma.stockPosition.create({ data: { productId: idBySku[p.sku], locationNodeId: nodeIdByDesignator[shelf], quantity: qty } });
    }

    // ~120 days of daily movements so consumption is real and the Stage-2
    // forecaster has enough history to work with (30-day minimum to forecast
    // at all, 90-day minimum for seasonality — see backend/prisma/seed.ts for
    // the full explanation, matched here at smaller scale).
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const HISTORY_DAYS = 120;
    const usageBySku: Record<string, number> = {};
    const movementRows: Prisma.StockMovementCreateManyInput[] = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const binId = nodeIdByDesignator[shelves[i % shelves.length]];
      movementRows.push({ clientId: `entity-seed-${randomUUID()}`, type: MovementType.GOODS_IN, productId: idBySku[p.sku], quantity: Math.ceil(p.max * 0.35), toLocationNodeId: binId, userId: keeperId, createdAt: new Date(now - (HISTORY_DAYS - 1) * DAY) });
      movementRows.push({ clientId: `entity-seed-${randomUUID()}`, type: MovementType.GOODS_IN, productId: idBySku[p.sku], quantity: Math.ceil(p.max * 0.25), toLocationNodeId: binId, userId: keeperId, createdAt: new Date(now - 58 * DAY) });

      const baseDailyUsage = p.reorder / 22;
      let totalOutTrailing30 = 0;
      for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
        const date = new Date(now - d * DAY);
        const dow = date.getUTCDay(); // UAE weekend: Sat/Sun
        const weekdayFactor = dow === 0 || dow === 6 ? 0.45 : 1.0;
        const noise = 0.55 + rnd() * 0.9;
        const q = Math.round(baseDailyUsage * weekdayFactor * noise);
        if (q <= 0) continue;
        movementRows.push({ clientId: `entity-seed-${randomUUID()}`, type: MovementType.GOODS_OUT, productId: idBySku[p.sku], quantity: q, fromLocationNodeId: binId, userId: keeperId, createdAt: date });
        if (d < 30) totalOutTrailing30 += q;
      }
      usageBySku[p.sku] = totalOutTrailing30 / 30;
    }
    const CHUNK = 500;
    for (let i = 0; i < movementRows.length; i += CHUNK) {
      await prisma.stockMovement.createMany({ data: movementRows.slice(i, i + CHUNK) });
    }

    // ...then PRE-SEED recommendations using the SAME engine the app uses, so the
    // Replenishment screen is full on first open (identical numbers + wording).
    const positions = await prisma.stockPosition.findMany({ where: { productId: { in: Object.values(idBySku) } } });
    for (const p of products) {
      const currentStock = positions.filter((x) => x.productId === idBySku[p.sku]).reduce((s, x) => s + x.quantity, 0);
      const dailyUsage = usageBySku[p.sku] ?? 0;
      const result = calculateReorder({ currentStock, dailyUsage, leadTimeDays: supplier.leadTimeDays, reorderPoint: p.reorder, maxLevel: p.max, packSize: 1 });
      if (!result.needsReorder) continue;
      const reasoning = generateReasoning({ currentStock, dailyUsage, leadTimeDays: supplier.leadTimeDays, daysToDepletion: result.daysToDepletion, suggestedQty: result.suggestedQty, reorderPoint: p.reorder });
      await prisma.recommendation.create({ data: { productId: idBySku[p.sku], suggestedQty: result.suggestedQty, reasonCode: result.reasonCode, reasoningEn: reasoning.reasoningEn, reasoningAr: reasoning.reasoningAr, status: 'PENDING' } });
      recCount++;
    }
  }

  console.log(`Entity "${CODE}" (${NAME_EN}) seeded — hierarchy Warehouse > Aisle > Shelf, ${units.length} units, 2 users` + (SAMPLE ? `, sample catalogue (${productCount} products, ${shelfCount} shelves, ${recCount} pre-seeded recommendations).` : ', blank catalogue (add products in-app or via Excel import).'));
  console.log('Logins:');
  console.log(`  ADMIN         ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}`);
  console.log(`  STORE_KEEPER  ${KEEPER_EMAIL}  /  ${KEEPER_PASSWORD}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
