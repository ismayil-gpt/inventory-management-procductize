// database/seed-data/seed.ts
// Generic demo data for any deployment — replace with the real organization's data when provided.
// Run from the backend folder (so @prisma/client + @node-rs/argon2 resolve):
//   $env:DATABASE_URL='postgresql://mizan:...@localhost:5432/mizan_inventory'
//   npx tsx ../database/seed-data/seed.ts
//
// Idempotent: it wipes the demo-owned tables first, so it can be re-run safely.
// (It never touches AuditLog / StockMovement, which are append-only.)
import { PrismaClient, Role, BarcodeSource, MovementType } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import { calculateReorder } from '../src/modules/replenishment/reorder-calculator';
import { generateReasoning } from '../src/modules/replenishment/reasoning-generator';

const prisma = new PrismaClient();

// Deterministic PRNG (not crypto-grade — just makes the demo dataset reproducible
// across re-seeds instead of different every time).
let _seed = 42;
const rnd = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; };

// Demo passwords (>= 12 chars, DESC #3). Printed at the end. Change via the app.
const DEMO_USERS = [
  { email: 'admin@example.com', password: 'Admin@Mizan2026', displayName: 'System Administrator', role: Role.ADMIN },
  { email: 'storekeeper@example.com', password: 'Store@Mizan2026', displayName: 'Store Keeper', role: Role.STORE_KEEPER },
];

async function main() {
  // ---- Clean (demo-owned tables only; append-only tables are never touched) ----
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

  // ---- Organization ----
  const org = await prisma.organization.create({
    data: { code: 'DEMO', nameEn: 'Demo Organization', nameAr: 'مؤسسة تجريبية', timezone: 'Asia/Dubai', defaultLanguage: 'en' },
  });
  const organizationId = org.id;

  // ---- Location types: STORE_ROOM > RACK > LEVEL ----
  const tStore = await prisma.locationType.create({ data: { organizationId, code: 'STORE_ROOM', nameEn: 'Store Room', nameAr: 'غرفة تخزين', depth: 0, canHoldStock: false, sortOrder: 0 } });
  const tRack  = await prisma.locationType.create({ data: { organizationId, code: 'RACK', nameEn: 'Rack', nameAr: 'رف', depth: 1, canHoldStock: false, sortOrder: 1 } });
  const tLevel = await prisma.locationType.create({ data: { organizationId, code: 'LEVEL', nameEn: 'Level', nameAr: 'طابق', depth: 2, canHoldStock: true, sortOrder: 2 } });
  const typeByCode: Record<string,string> = { STORE_ROOM: tStore.id, RACK: tRack.id, LEVEL: tLevel.id };

  // ---- Units of measure ----
  const unit_UNIT = await prisma.unitOfMeasure.create({ data: { organizationId, code: 'UNIT', nameEn: 'Unit', nameAr: 'وحدة', isBaseUnit: true } });
  const unit_BOX = await prisma.unitOfMeasure.create({ data: { organizationId, code: 'BOX', nameEn: 'Box', nameAr: 'علبة', isBaseUnit: false } });
  const unit_CARTON = await prisma.unitOfMeasure.create({ data: { organizationId, code: 'CARTON', nameEn: 'Carton', nameAr: 'كرتون', isBaseUnit: false } });
  const unit_PACK = await prisma.unitOfMeasure.create({ data: { organizationId, code: 'PACK', nameEn: 'Pack', nameAr: 'باقة', isBaseUnit: false } });
  const unit_ROLL = await prisma.unitOfMeasure.create({ data: { organizationId, code: 'ROLL', nameEn: 'Roll', nameAr: 'لفة', isBaseUnit: false } });
  const unit_BOTTLE = await prisma.unitOfMeasure.create({ data: { organizationId, code: 'BOTTLE', nameEn: 'Bottle', nameAr: 'زجاجة', isBaseUnit: false } });
  const unit_KG = await prisma.unitOfMeasure.create({ data: { organizationId, code: 'KG', nameEn: 'Kilogram', nameAr: 'كيلوغرام', isBaseUnit: false } });
  const unitByCode: Record<string,string> = { UNIT: unit_UNIT.id, BOX: unit_BOX.id, CARTON: unit_CARTON.id, PACK: unit_PACK.id, ROLL: unit_ROLL.id, BOTTLE: unit_BOTTLE.id, KG: unit_KG.id };

  // ---- Categories ----
  const cat_CAT_HOTBEV = await prisma.productCategory.create({ data: { organizationId, code: 'CAT-HOTBEV', nameEn: 'Hot Beverages', nameAr: 'المشروبات الساخنة', materialisedPath: '/CAT-HOTBEV', sortOrder: 0 } });
  const cat_CAT_COLDBEV = await prisma.productCategory.create({ data: { organizationId, code: 'CAT-COLDBEV', nameEn: 'Cold Beverages & Water', nameAr: 'المشروبات الباردة والمياه', materialisedPath: '/CAT-COLDBEV', sortOrder: 0 } });
  const cat_CAT_DAIRY = await prisma.productCategory.create({ data: { organizationId, code: 'CAT-DAIRY', nameEn: 'Dairy & Creamers', nameAr: 'الألبان والمبيضات', materialisedPath: '/CAT-DAIRY', sortOrder: 0 } });
  const cat_CAT_SWEET = await prisma.productCategory.create({ data: { organizationId, code: 'CAT-SWEET', nameEn: 'Sweeteners & Snacks', nameAr: 'المحليات والوجبات الخفيفة', materialisedPath: '/CAT-SWEET', sortOrder: 0 } });
  const cat_CAT_DISPOSE = await prisma.productCategory.create({ data: { organizationId, code: 'CAT-DISPOSE', nameEn: 'Disposables & Tissue', nameAr: 'المستهلكات والمناديل', materialisedPath: '/CAT-DISPOSE', sortOrder: 0 } });
  const cat_CAT_CLEAN = await prisma.productCategory.create({ data: { organizationId, code: 'CAT-CLEAN', nameEn: 'Cleaning Supplies', nameAr: 'مواد التنظيف', materialisedPath: '/CAT-CLEAN', sortOrder: 0 } });
  const cat_CAT_OFFICE = await prisma.productCategory.create({ data: { organizationId, code: 'CAT-OFFICE', nameEn: 'Office Consumables', nameAr: 'مستلزمات المكتب', materialisedPath: '/CAT-OFFICE', sortOrder: 0 } });
  const catByCode: Record<string,string> = { 'CAT-HOTBEV': cat_CAT_HOTBEV.id, 'CAT-COLDBEV': cat_CAT_COLDBEV.id, 'CAT-DAIRY': cat_CAT_DAIRY.id, 'CAT-SWEET': cat_CAT_SWEET.id, 'CAT-DISPOSE': cat_CAT_DISPOSE.id, 'CAT-CLEAN': cat_CAT_CLEAN.id, 'CAT-OFFICE': cat_CAT_OFFICE.id };

  // ---- Suppliers ----
  const sup_SUP_BEV = await prisma.supplier.create({ data: { name: 'Gulf Beverages & Catering Supplies LLC', email: 'orders@gulfbeverages.ae', leadTimeDays: 4 } });
  const sup_SUP_PANTRY = await prisma.supplier.create({ data: { name: 'Emirates Pantry Distribution', email: 'sales@emiratespantry.ae', leadTimeDays: 3 } });
  const sup_SUP_CLEAN = await prisma.supplier.create({ data: { name: 'Al Noor Hygiene & Cleaning Supplies', email: 'orders@alnoorhygiene.ae', leadTimeDays: 5 } });
  const sup_SUP_OFFICE = await prisma.supplier.create({ data: { name: 'Capital Office Supplies Trading', email: 'cs@capitaloffice.ae', leadTimeDays: 7 } });
  const sup_SUP_WATER = await prisma.supplier.create({ data: { name: 'PureAqua Water Solutions', email: 'delivery@pureaqua.ae', leadTimeDays: 2 } });
  const supByCode: Record<string,string> = { 'SUP-BEV': sup_SUP_BEV.id, 'SUP-PANTRY': sup_SUP_PANTRY.id, 'SUP-CLEAN': sup_SUP_CLEAN.id, 'SUP-OFFICE': sup_SUP_OFFICE.id, 'SUP-WATER': sup_SUP_WATER.id };
  const leadTimeByCode: Record<string, number> = { 'SUP-BEV': 4, 'SUP-PANTRY': 3, 'SUP-CLEAN': 5, 'SUP-OFFICE': 7, 'SUP-WATER': 2 };

  // ---- Location tree (2 store rooms x 6 racks x 5 levels = 60 shelves) ----
  const nodeIdByDesignator: Record<string,string> = {};
  const locationSeed: Array<{code:string;designator:string;depth:number;typeCode:string;parent:string;barcode:string|null}> = [];
  for (const sr of ['SR1', 'SR2']) {
    locationSeed.push({ code: sr, designator: sr, depth: 0, typeCode: 'STORE_ROOM', parent: '', barcode: null });
    for (let r = 1; r <= 6; r++) {
      const rackDes = `${sr}-R${r}`;
      locationSeed.push({ code: `R${r}`, designator: rackDes, depth: 1, typeCode: 'RACK', parent: sr, barcode: null });
      for (let l = 1; l <= 5; l++) {
        const levelDes = `${rackDes}-L${l}`;
        locationSeed.push({ code: `L${l}`, designator: levelDes, depth: 2, typeCode: 'LEVEL', parent: rackDes, barcode: `LOC-${levelDes}` });
      }
    }
  }
  for (const n of locationSeed) {
    const parentId = n.parent ? nodeIdByDesignator[n.parent] : null;
    const path = '/' + n.designator.split('-').join('/');
    const created = await prisma.locationNode.create({
      data: { organizationId, parentId, locationTypeId: typeByCode[n.typeCode], code: n.code, designator: n.designator, materialisedPath: path, depth: n.depth, barcode: n.barcode },
    });
    nodeIdByDesignator[n.designator] = created.id;
  }

  // ---- Products ----
  const productIdBySku: Record<string,string> = {};
  const productSeed = [
    { sku:'PRD-0001', barcode:'6291041500213', source:'MANUFACTURER', nameEn:'Arabic Coffee Powder 250g', nameAr:'بن عربي مطحون ٢٥٠غ', cat:'CAT-HOTBEV', unit:'BOX', pack:1, reorder:20, min:10, max:80, supplier:'SUP-BEV' },
    { sku:'PRD-0002', barcode:'6291041500220', source:'MANUFACTURER', nameEn:'Instant Coffee 200g Jar', nameAr:'قهوة سريعة التحضير ٢٠٠غ', cat:'CAT-HOTBEV', unit:'BOX', pack:1, reorder:15, min:8, max:60, supplier:'SUP-BEV' },
    { sku:'PRD-0003', barcode:'7622210991027', source:'MANUFACTURER', nameEn:'Cardamom Whole 100g', nameAr:'هيل حبوب ١٠٠غ', cat:'CAT-HOTBEV', unit:'BOX', pack:1, reorder:10, min:5, max:30, supplier:'SUP-BEV' },
    { sku:'PRD-0004', barcode:'6291041500244', source:'MANUFACTURER', nameEn:'Black Tea Bags (100s)', nameAr:'أكياس شاي أسود (١٠٠)', cat:'CAT-HOTBEV', unit:'BOX', pack:1, reorder:25, min:12, max:90, supplier:'SUP-BEV' },
    { sku:'PRD-0005', barcode:'6291041500251', source:'MANUFACTURER', nameEn:'Green Tea Bags (100s)', nameAr:'أكياس شاي أخضر (١٠٠)', cat:'CAT-HOTBEV', unit:'BOX', pack:1, reorder:15, min:8, max:50, supplier:'SUP-BEV' },
    { sku:'PRD-0006', barcode:'6291041500268', source:'MANUFACTURER', nameEn:'Hot Chocolate Powder 1kg', nameAr:'مسحوق شوكولاتة ساخنة ١كغ', cat:'CAT-HOTBEV', unit:'BOX', pack:1, reorder:10, min:5, max:40, supplier:'SUP-BEV' },
    { sku:'PRD-0007', barcode:'6281006000112', source:'MANUFACTURER', nameEn:'Coffee Mate Creamer 450g', nameAr:'مبيّض القهوة ٤٥٠غ', cat:'CAT-DAIRY', unit:'BOX', pack:1, reorder:20, min:10, max:70, supplier:'SUP-PANTRY' },
    { sku:'PRD-0008', barcode:'6281006000129', source:'MANUFACTURER', nameEn:'Evaporated Milk 410g Tin', nameAr:'حليب مبخر ٤١٠غ', cat:'CAT-DAIRY', unit:'CARTON', pack:24, reorder:30, min:15, max:120, supplier:'SUP-PANTRY' },
    { sku:'PRD-0009', barcode:'6281006000136', source:'MANUFACTURER', nameEn:'Full Cream Milk Powder 900g', nameAr:'حليب كامل الدسم بودرة ٩٠٠غ', cat:'CAT-DAIRY', unit:'BOX', pack:1, reorder:18, min:9, max:60, supplier:'SUP-PANTRY' },
    { sku:'PRD-0010', barcode:'6281006000143', source:'MANUFACTURER', nameEn:'UHT Milk 1L', nameAr:'حليب طويل الأمد ١ لتر', cat:'CAT-DAIRY', unit:'CARTON', pack:12, reorder:40, min:20, max:150, supplier:'SUP-PANTRY' },
    { sku:'PRD-0011', barcode:'6291100000117', source:'MANUFACTURER', nameEn:'White Sugar 1kg', nameAr:'سكر أبيض ١كغ', cat:'CAT-SWEET', unit:'CARTON', pack:10, reorder:35, min:18, max:140, supplier:'SUP-PANTRY' },
    { sku:'PRD-0012', barcode:'6291100000124', source:'MANUFACTURER', nameEn:'Sugar Sticks (1000s)', nameAr:'أعواد سكر (١٠٠٠)', cat:'CAT-SWEET', unit:'BOX', pack:1, reorder:20, min:10, max:60, supplier:'SUP-PANTRY' },
    { sku:'PRD-0013', barcode:'6291100000131', source:'MANUFACTURER', nameEn:'Sweetener Tablets (500s)', nameAr:'أقراص التحلية (٥٠٠)', cat:'CAT-SWEET', unit:'BOX', pack:1, reorder:12, min:6, max:40, supplier:'SUP-PANTRY' },
    { sku:'PRD-0014', barcode:'6291100000148', source:'MANUFACTURER', nameEn:'Assorted Biscuits 500g', nameAr:'بسكويت متنوع ٥٠٠غ', cat:'CAT-SWEET', unit:'BOX', pack:1, reorder:25, min:12, max:90, supplier:'SUP-PANTRY' },
    { sku:'PRD-0015', barcode:'6291100000155', source:'MANUFACTURER', nameEn:'Dark Chocolate Bars (24s)', nameAr:'ألواح شوكولاتة داكنة (٢٤)', cat:'CAT-SWEET', unit:'BOX', pack:24, reorder:15, min:8, max:60, supplier:'SUP-PANTRY' },
    { sku:'PRD-0016', barcode:'6291100000162', source:'MANUFACTURER', nameEn:'Dates 500g Pack', nameAr:'تمر ٥٠٠غ', cat:'CAT-SWEET', unit:'BOX', pack:1, reorder:20, min:10, max:80, supplier:'SUP-PANTRY' },
    { sku:'PRD-0017', barcode:'6291100000179', source:'MANUFACTURER', nameEn:'Mixed Nuts 250g', nameAr:'مكسّرات مشكّلة ٢٥٠غ', cat:'CAT-SWEET', unit:'BOX', pack:1, reorder:15, min:8, max:50, supplier:'SUP-PANTRY' },
    { sku:'PRD-0018', barcode:'6291200000114', source:'MANUFACTURER', nameEn:'Bottled Water 500ml (24s)', nameAr:'مياه معبأة ٥٠٠مل (٢٤)', cat:'CAT-COLDBEV', unit:'CARTON', pack:24, reorder:60, min:30, max:240, supplier:'SUP-WATER' },
    { sku:'PRD-0019', barcode:'6291200000121', source:'MANUFACTURER', nameEn:'Bottled Water 1.5L (6s)', nameAr:'مياه معبأة ١.٥ لتر (٦)', cat:'CAT-COLDBEV', unit:'CARTON', pack:6, reorder:40, min:20, max:160, supplier:'SUP-WATER' },
    { sku:'PRD-0020', barcode:'6291200000138', source:'MANUFACTURER', nameEn:'Orange Juice 1L', nameAr:'عصير برتقال ١ لتر', cat:'CAT-COLDBEV', unit:'CARTON', pack:12, reorder:20, min:10, max:80, supplier:'SUP-WATER' },
    { sku:'PRD-0021', barcode:'6291200000145', source:'MANUFACTURER', nameEn:'Laban Up 180ml (18s)', nameAr:'لبن أب ١٨٠مل (١٨)', cat:'CAT-COLDBEV', unit:'CARTON', pack:18, reorder:15, min:8, max:60, supplier:'SUP-WATER' },
    { sku:'PRD-0022', barcode:'6291300000111', source:'MANUFACTURER', nameEn:'Facial Tissue Box (100s)', nameAr:'محارم وجه (١٠٠)', cat:'CAT-DISPOSE', unit:'CARTON', pack:30, reorder:40, min:20, max:150, supplier:'SUP-CLEAN' },
    { sku:'PRD-0023', barcode:'6291300000128', source:'MANUFACTURER', nameEn:'Toilet Roll (12s)', nameAr:'لفائف حمام (١٢)', cat:'CAT-DISPOSE', unit:'CARTON', pack:8, reorder:50, min:25, max:200, supplier:'SUP-CLEAN' },
    { sku:'PRD-0024', barcode:'6291300000135', source:'MANUFACTURER', nameEn:'Kitchen Towel Roll (6s)', nameAr:'مناشف مطبخ (٦)', cat:'CAT-DISPOSE', unit:'CARTON', pack:8, reorder:30, min:15, max:120, supplier:'SUP-CLEAN' },
    { sku:'PRD-0025', barcode:'6291300000142', source:'MANUFACTURER', nameEn:'Paper Cups 8oz (50s)', nameAr:'أكواب ورقية ٨أونصة (٥٠)', cat:'CAT-DISPOSE', unit:'PACK', pack:1, reorder:45, min:22, max:180, supplier:'SUP-CLEAN' },
    { sku:'PRD-0026', barcode:'6291300000159', source:'MANUFACTURER', nameEn:'Paper Cups 4oz Arabic (50s)', nameAr:'أكواب ورقية ٤أونصة (٥٠)', cat:'CAT-DISPOSE', unit:'PACK', pack:1, reorder:40, min:20, max:160, supplier:'SUP-CLEAN' },
    { sku:'PRD-0027', barcode:'6291300000166', source:'MANUFACTURER', nameEn:'Plastic Stirrers (1000s)', nameAr:'محرّكات بلاستيكية (١٠٠٠)', cat:'CAT-DISPOSE', unit:'BOX', pack:1, reorder:15, min:8, max:50, supplier:'SUP-CLEAN' },
    { sku:'PRD-0028', barcode:'6291300000173', source:'MANUFACTURER', nameEn:'Plastic Teaspoons (100s)', nameAr:'ملاعق بلاستيكية (١٠٠)', cat:'CAT-DISPOSE', unit:'PACK', pack:1, reorder:20, min:10, max:70, supplier:'SUP-CLEAN' },
    { sku:'PRD-0029', barcode:'6291300000180', source:'MANUFACTURER', nameEn:'Napkins Dinner (100s)', nameAr:'مناديل سفرة (١٠٠)', cat:'CAT-DISPOSE', unit:'PACK', pack:1, reorder:35, min:18, max:140, supplier:'SUP-CLEAN' },
    { sku:'PRD-0030', barcode:'6291400000118', source:'MANUFACTURER', nameEn:'Dishwashing Liquid 1L', nameAr:'سائل غسيل الصحون ١ لتر', cat:'CAT-CLEAN', unit:'BOTTLE', pack:1, reorder:20, min:10, max:70, supplier:'SUP-CLEAN' },
    { sku:'PRD-0031', barcode:'6291400000125', source:'MANUFACTURER', nameEn:'Multi-Surface Cleaner 750ml', nameAr:'منظف متعدد الأسطح ٧٥٠مل', cat:'CAT-CLEAN', unit:'BOTTLE', pack:1, reorder:18, min:9, max:60, supplier:'SUP-CLEAN' },
    { sku:'PRD-0032', barcode:'6291400000132', source:'MANUFACTURER', nameEn:'Hand Soap Refill 1L', nameAr:'صابون يدين لإعادة التعبئة ١ لتر', cat:'CAT-CLEAN', unit:'BOTTLE', pack:1, reorder:25, min:12, max:90, supplier:'SUP-CLEAN' },
    { sku:'PRD-0033', barcode:'6291400000149', source:'MANUFACTURER', nameEn:'Hand Sanitizer 500ml', nameAr:'معقّم اليدين ٥٠٠مل', cat:'CAT-CLEAN', unit:'BOTTLE', pack:1, reorder:30, min:15, max:110, supplier:'SUP-CLEAN' },
    { sku:'PRD-0034', barcode:'6291400000156', source:'MANUFACTURER', nameEn:'Disinfectant Wipes (80s)', nameAr:'مناديل مطهّرة (٨٠)', cat:'CAT-CLEAN', unit:'BOX', pack:1, reorder:25, min:12, max:90, supplier:'SUP-CLEAN' },
    { sku:'PRD-0035', barcode:'6291400000163', source:'MANUFACTURER', nameEn:'Garbage Bags Large (50s)', nameAr:'أكياس قمامة كبيرة (٥٠)', cat:'CAT-CLEAN', unit:'ROLL', pack:1, reorder:30, min:15, max:120, supplier:'SUP-CLEAN' },
    { sku:'PRD-0036', barcode:'6291400000170', source:'MANUFACTURER', nameEn:'Glass Cleaner 500ml', nameAr:'منظف زجاج ٥٠٠مل', cat:'CAT-CLEAN', unit:'BOTTLE', pack:1, reorder:12, min:6, max:40, supplier:'SUP-CLEAN' },
    { sku:'PRD-0037', barcode:'6291400000187', source:'MANUFACTURER', nameEn:'Floor Cleaner 5L', nameAr:'منظف أرضيات ٥ لتر', cat:'CAT-CLEAN', unit:'BOTTLE', pack:1, reorder:10, min:5, max:35, supplier:'SUP-CLEAN' },
    { sku:'PRD-0038', barcode:'6291400000194', source:'MANUFACTURER', nameEn:'Air Freshener Spray 300ml', nameAr:'معطّر جو بخّاخ ٣٠٠مل', cat:'CAT-CLEAN', unit:'BOTTLE', pack:1, reorder:20, min:10, max:70, supplier:'SUP-CLEAN' },
    { sku:'PRD-0039', barcode:'6291500000115', source:'MANUFACTURER', nameEn:'A4 Paper Ream 80gsm', nameAr:'ورق A4 ٨٠غ', cat:'CAT-OFFICE', unit:'CARTON', pack:5, reorder:40, min:20, max:160, supplier:'SUP-OFFICE' },
    { sku:'PRD-0040', barcode:'6291500000122', source:'MANUFACTURER', nameEn:'Ballpoint Pens Blue (50s)', nameAr:'أقلام حبر زرقاء (٥٠)', cat:'CAT-OFFICE', unit:'BOX', pack:1, reorder:25, min:12, max:90, supplier:'SUP-OFFICE' },
    { sku:'PRD-0041', barcode:'6291500000139', source:'MANUFACTURER', nameEn:'Whiteboard Marker Set (4s)', nameAr:'أقلام سبورة (٤)', cat:'CAT-OFFICE', unit:'PACK', pack:1, reorder:20, min:10, max:70, supplier:'SUP-OFFICE' },
    { sku:'PRD-0042', barcode:'6291500000146', source:'MANUFACTURER', nameEn:'Stapler Pins (5000s)', nameAr:'دبابيس تدبيس (٥٠٠٠)', cat:'CAT-OFFICE', unit:'BOX', pack:1, reorder:15, min:8, max:50, supplier:'SUP-OFFICE' },
    { sku:'PRD-0043', barcode:'6291500000153', source:'MANUFACTURER', nameEn:'Sticky Notes 3x3 (12s)', nameAr:'أوراق لاصقة ٣×٣ (١٢)', cat:'CAT-OFFICE', unit:'PACK', pack:1, reorder:20, min:10, max:70, supplier:'SUP-OFFICE' },
    { sku:'PRD-0044', barcode:'6291500000160', source:'MANUFACTURER', nameEn:'File Folders A4 (25s)', nameAr:'مجلدات ملفات A4 (٢٥)', cat:'CAT-OFFICE', unit:'PACK', pack:1, reorder:18, min:9, max:60, supplier:'SUP-OFFICE' },
    { sku:'PRD-0045', barcode:'6291500000177', source:'MANUFACTURER', nameEn:'Printer Toner Black', nameAr:'حبر طابعة أسود', cat:'CAT-OFFICE', unit:'UNIT', pack:1, reorder:8, min:4, max:24, supplier:'SUP-OFFICE' },
    { sku:'PRD-0046', barcode:'6291500000184', source:'MANUFACTURER', nameEn:'Highlighters Assorted (6s)', nameAr:'أقلام تحديد متنوعة (٦)', cat:'CAT-OFFICE', unit:'PACK', pack:1, reorder:15, min:8, max:50, supplier:'SUP-OFFICE' },
    { sku:'PRD-0047', barcode:'INT-000047001', source:'INTERNAL', nameEn:'Arabic Coffee Blend (Repacked) 500g', nameAr:'خلطة قهوة عربية (معبأة) ٥٠٠غ', cat:'CAT-HOTBEV', unit:'BOX', pack:1, reorder:15, min:8, max:50, supplier:'SUP-BEV' },
    { sku:'PRD-0048', barcode:'INT-000048001', source:'INTERNAL', nameEn:'Assorted Dates Gift Box (Repacked)', nameAr:'علبة تمور هدايا (معبأة)', cat:'CAT-SWEET', unit:'BOX', pack:1, reorder:10, min:5, max:40, supplier:'SUP-PANTRY' },
    { sku:'PRD-0049', barcode:'INT-000049001', source:'INTERNAL', nameEn:'Majlis Incense Bakhoor 50g', nameAr:'بخور مجلس ٥٠غ', cat:'CAT-OFFICE', unit:'BOX', pack:1, reorder:8, min:4, max:30, supplier:'SUP-OFFICE' },
    { sku:'PRD-0050', barcode:'INT-000050001', source:'INTERNAL', nameEn:'Rose Water Spray 250ml', nameAr:'ماء ورد بخّاخ ٢٥٠مل', cat:'CAT-OFFICE', unit:'BOTTLE', pack:1, reorder:10, min:5, max:35, supplier:'SUP-OFFICE' },
  ];
  for (const p of productSeed) {
    const created = await prisma.product.create({
      data: {
        organizationId, sku: p.sku, barcode: p.barcode, barcodeSource: p.source as BarcodeSource,
        nameEn: p.nameEn, nameAr: p.nameAr, categoryId: catByCode[p.cat], baseUnitId: unitByCode[p.unit],
        packSize: p.pack, reorderPoint: p.reorder, minLevel: p.min, maxLevel: p.max, supplierId: supByCode[p.supplier],
      },
    });
    productIdBySku[p.sku] = created.id;
  }

  // ---- Stock positions ----
  const stockSeed = [
    { sku:'PRD-0001', loc:'SR2-R2-L4', qty:20 }, { sku:'PRD-0001', loc:'SR2-R4-L1', qty:12 }, { sku:'PRD-0002', loc:'SR1-R5-L4', qty:55 },
    { sku:'PRD-0003', loc:'SR2-R5-L5', qty:22 }, { sku:'PRD-0004', loc:'SR1-R3-L2', qty:50 }, { sku:'PRD-0005', loc:'SR1-R4-L2', qty:20 },
    { sku:'PRD-0006', loc:'SR1-R5-L1', qty:12 }, { sku:'PRD-0007', loc:'SR2-R6-L1', qty:17 }, { sku:'PRD-0008', loc:'SR2-R6-L4', qty:60 },
    { sku:'PRD-0008', loc:'SR1-R6-L5', qty:6 }, { sku:'PRD-0009', loc:'SR2-R1-L4', qty:24 }, { sku:'PRD-0010', loc:'SR1-R4-L5', qty:150 },
    { sku:'PRD-0011', loc:'SR1-R2-L5', qty:65 }, { sku:'PRD-0012', loc:'SR2-R2-L2', qty:27 }, { sku:'PRD-0013', loc:'SR2-R1-L2', qty:9 },
    { sku:'PRD-0014', loc:'SR2-R4-L1', qty:61 }, { sku:'PRD-0015', loc:'SR2-R1-L1', qty:45 }, { sku:'PRD-0015', loc:'SR2-R3-L5', qty:12 },
    { sku:'PRD-0016', loc:'SR2-R4-L5', qty:74 }, { sku:'PRD-0017', loc:'SR1-R1-L4', qty:39 }, { sku:'PRD-0018', loc:'SR1-R5-L2', qty:102 },
    { sku:'PRD-0019', loc:'SR2-R5-L1', qty:28 }, { sku:'PRD-0020', loc:'SR1-R1-L5', qty:43 }, { sku:'PRD-0021', loc:'SR1-R6-L5', qty:29 },
    { sku:'PRD-0022', loc:'SR1-R3-L1', qty:126 }, { sku:'PRD-0022', loc:'SR2-R4-L4', qty:6 }, { sku:'PRD-0023', loc:'SR2-R6-L5', qty:69 },
    { sku:'PRD-0024', loc:'SR1-R5-L3', qty:108 }, { sku:'PRD-0025', loc:'SR2-R3-L2', qty:39 }, { sku:'PRD-0026', loc:'SR1-R5-L5', qty:62 },
    { sku:'PRD-0027', loc:'SR1-R1-L1', qty:50 }, { sku:'PRD-0028', loc:'SR2-R3-L5', qty:67 }, { sku:'PRD-0029', loc:'SR1-R6-L1', qty:67 },
    { sku:'PRD-0029', loc:'SR2-R4-L2', qty:4 }, { sku:'PRD-0030', loc:'SR2-R5-L3', qty:50 }, { sku:'PRD-0031', loc:'SR1-R4-L4', qty:12 },
    { sku:'PRD-0032', loc:'SR1-R6-L4', qty:60 }, { sku:'PRD-0033', loc:'SR2-R2-L5', qty:102 }, { sku:'PRD-0034', loc:'SR1-R6-L2', qty:54 },
    { sku:'PRD-0035', loc:'SR2-R4-L4', qty:118 }, { sku:'PRD-0036', loc:'SR1-R3-L3', qty:23 }, { sku:'PRD-0036', loc:'SR2-R5-L2', qty:2 },
    { sku:'PRD-0037', loc:'SR2-R2-L1', qty:5 }, { sku:'PRD-0038', loc:'SR2-R3-L3', qty:23 }, { sku:'PRD-0039', loc:'SR2-R1-L3', qty:144 },
    { sku:'PRD-0040', loc:'SR2-R5-L4', qty:66 }, { sku:'PRD-0041', loc:'SR1-R3-L4', qty:46 }, { sku:'PRD-0042', loc:'SR2-R4-L2', qty:33 },
    { sku:'PRD-0043', loc:'SR2-R6-L3', qty:8 }, { sku:'PRD-0043', loc:'SR1-R4-L3', qty:5 }, { sku:'PRD-0044', loc:'SR1-R1-L3', qty:55 },
    { sku:'PRD-0045', loc:'SR1-R6-L3', qty:19 }, { sku:'PRD-0046', loc:'SR2-R2-L3', qty:29 }, { sku:'PRD-0047', loc:'SR1-R2-L1', qty:47 },
    { sku:'PRD-0048', loc:'SR2-R1-L5', qty:23 }, { sku:'PRD-0049', loc:'SR2-R5-L2', qty:8 }, { sku:'PRD-0050', loc:'SR2-R3-L4', qty:15 },
    { sku:'PRD-0050', loc:'SR2-R5-L5', qty:6 },
  ];
  for (const s of stockSeed) {
    await prisma.stockPosition.create({ data: { productId: productIdBySku[s.sku], locationNodeId: nodeIdByDesignator[s.loc], quantity: s.qty } });
  }

  // ---- Two demo users with REAL argon2id password hashes (DESC #3) ----
  let keeperUserId = '';
  for (const u of DEMO_USERS) {
    const created = await prisma.user.create({
      data: { email: u.email, passwordHash: await hash(u.password), displayName: u.displayName, role: u.role, preferredLanguage: 'en' },
    });
    if (u.role === Role.STORE_KEEPER) keeperUserId = created.id;
  }

  // ---- 30 days of movement history per product ----
  // The AI Store Manager's reorder calculator (§8.2) uses trailing-30-day GOODS_OUT
  // volume to compute dailyUsage. Without movement history every product falls back
  // to "no recent usage recorded" and the reorder point alone decides — real history
  // here gives genuine consumption rates, so recommendations and their reasoning
  // (§8.3) reflect real numbers instead of a placeholder.
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const firstLocBySku: Record<string, string> = {};
  for (const s of stockSeed) if (!firstLocBySku[s.sku]) firstLocBySku[s.sku] = s.loc;
  const dailyUsageBySku: Record<string, number> = {};
  let movementCount = 0;

  for (const p of productSeed) {
    const binId = nodeIdByDesignator[firstLocBySku[p.sku]];

    // An initial restock near the start of the window.
    await prisma.stockMovement.create({
      data: { clientId: `seed-${randomUUID()}`, type: MovementType.GOODS_IN, productId: productIdBySku[p.sku], quantity: Math.max(1, Math.round(p.max * 0.4)), toLocationNodeId: binId, userId: keeperUserId, createdAt: new Date(now - 29 * DAY) },
    });
    movementCount++;

    // A handful of goods-out issues spread across the month, scaled to the
    // product's reorder point so the resulting daily usage is realistic.
    const issues = 4 + Math.floor(rnd() * 6); // 4-9 issues over 30 days
    let totalOut = 0;
    for (let k = 0; k < issues; k++) {
      const q = 1 + Math.floor(rnd() * Math.max(2, Math.round(p.reorder / 6)));
      totalOut += q;
      await prisma.stockMovement.create({
        data: { clientId: `seed-${randomUUID()}`, type: MovementType.GOODS_OUT, productId: productIdBySku[p.sku], quantity: q, fromLocationNodeId: binId, userId: keeperUserId, createdAt: new Date(now - (1 + Math.floor(rnd() * 28)) * DAY) },
      });
      movementCount++;
    }
    dailyUsageBySku[p.sku] = totalOut / 30;
  }

  // ---- Pre-seed recommendations using the SAME deterministic engine the daily job
  // uses, so the Replenishment screen is accurate and populated on first login,
  // identical in numbers and wording to a live run (§8.2, §8.3). ----
  let recCount = 0;
  for (const p of productSeed) {
    const currentStock = stockSeed.filter((s) => s.sku === p.sku).reduce((sum, s) => sum + s.qty, 0);
    const dailyUsage = dailyUsageBySku[p.sku] ?? 0;
    const leadTimeDays = leadTimeByCode[p.supplier];
    const result = calculateReorder({ currentStock, dailyUsage, leadTimeDays, reorderPoint: p.reorder, maxLevel: p.max, packSize: p.pack });
    if (!result.needsReorder) continue;
    const reasoning = generateReasoning({ currentStock, dailyUsage, leadTimeDays, daysToDepletion: result.daysToDepletion, suggestedQty: result.suggestedQty, reorderPoint: p.reorder });
    await prisma.recommendation.create({
      data: { productId: productIdBySku[p.sku], suggestedQty: result.suggestedQty, reasonCode: result.reasonCode, reasoningEn: reasoning.reasoningEn, reasoningAr: reasoning.reasoningAr, status: 'PENDING' },
    });
    recCount++;
  }

  console.log(`Seed complete: 1 org, 3 location types, ${locationSeed.length} nodes (60 shelves), 7 categories, 7 units, 5 suppliers, ${productSeed.length} products, ${stockSeed.length} stock rows, ${movementCount} movements (30-day history), ${recCount} pre-seeded recommendations, ${DEMO_USERS.length} users.`);
  console.log('Demo logins:');
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(12)}  ${u.email}  /  ${u.password}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
