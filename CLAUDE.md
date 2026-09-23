# CLAUDE.md — Mizan AI Inventory Management System

> **Build specification. Read this file completely before writing any code.**
> Project: Mizan — a multi-tenant, configuration-driven AI-based inventory management platform.
> Vendor: Grow Plus Technologies
> Deployment: fully on-premise. No cloud services. No external API calls at runtime.
> Compliance: **DESC (Dubai Electronic Security Center) — mandatory across every layer.**

---

## 0. START HERE

When you first read this file, do this in order:

1. Read this document end to end. Do not skim §9 (Design System) or §11 (DESC Compliance) — those are the two most often got wrong.
2. Check what already exists in the repository. Do not scaffold over existing work.
3. If the repository is empty, execute **Phase 0** (§13.1): create the folder structure, `docker-compose.development.yml`, shared packages, and a running health check on all three services. Verify it starts before writing feature code.
4. Work through the phases in §13 in order. Do not start Stage 2 features until MVP is complete and tested.
5. At the end of every session, update `PROGRESS.md`.

**Rules that apply to every task:**

- We are currently in **development environment** (a laptop). Read §2 to understand what that changes. Everything must remain swappable to the production environment by configuration alone — never by rewriting code.
- Never call an external network service at runtime. The only permitted outbound traffic is SMTP for supplier email.
- Every user-facing string goes through translation files. No hardcoded English in components.
- Every colour, spacing value, radius and font size comes from the design tokens in §9.
- Every state change writes an audit record in the same database transaction.
- Every feature produces its DESC evidence artifact (§11.3) as it is built, not afterwards.
- **This is a product, not a one-off.** Storage structure, product catalogue and vocabulary are
  configuration, never code (§5A). Never hardcode "store room", "rack", "level", a depth of
  three, or a count of two. Every deployment is a distinct customer — build for configurability,
  never for one fixed shape.
- Write tests alongside features, not after.

If something is genuinely ambiguous, record it in `OPEN-QUESTIONS.md`, choose the more conservative option, and keep moving.

---

## 1. What this system does

A stock-room inventory system for two store rooms holding consumables (coffee, sugar, cleaning supplies, stationery — roughly 50 distinct products, 1,000–2,000 units).

Core loop:

1. Every product and every shelf location carries a barcode.
2. A Store Keeper scans a location, then scans a product, and records a movement (goods in / goods out / transfer / cycle count / adjustment).
3. Stock quantity and exact physical location update in real time; an immutable audit record is written.
4. Each day at a configured time, the **AI Store Manager** reviews stock, consumption and supplier lead times, and determines what needs reordering.
5. It notifies the designated officer with a recommendation **and the reasoning behind it**.
6. The Administrator approves, amends or rejects.
7. On approval, the system generates a PDF purchase order and emails it to the supplier.
8. Goods arrive, are scanned in, and the cycle closes.

**The system never places an order autonomously.** AI recommends; a human approves. This is a hard governance requirement.

### Scale

| Fact | Value |
|---|---|
| Store rooms | 2 (`SR1`, `SR2`), ~50 m apart |
| Racks per room | ~6 (`R1`–`R6`) — confirm in Phase 1 |
| Levels per rack | ~5 (`L1`–`L5`) |
| Storage locations | ~60 total |
| Products at launch | 50 distinct SKUs |
| Total units | 1,000–2,000 |
| Named users | up to 5 |
| Roles | 2 — `ADMIN`, `STORE_KEEPER` |

These are one deployment's numbers, **not limits of the system**. The platform is built to be resold
(§5A): the same code must serve one store room or several warehouses with aisles and bins,
configured through the interface. Optimise for correctness, auditability and legibility — not
for throughput.

### Explicitly out of scope

RFID, expiry/batch tracking, external ERP integration, "Government Grid" integration, multi-tenancy, native app-store mobile apps, Arabic-language PDF/Excel generation.

---

## 2. Environments — development now, production later

We are building on a laptop. The production server and GPU arrive later. **The architecture must not change when we move.** Only configuration changes.

| | Development (now, laptop) | Production (later, on-premise) |
|---|---|---|
| Compose file | `docker-compose.development.yml` | `docker-compose.production.yml` |
| Language model | **Llama 3.2 3B (Q4)** | **Qwen 2.5 14B Instruct (Q4)** |
| Model runtime | Ollama on CPU | Ollama on GPU |
| Forecasting | statsmodels, CPU | statsmodels → LightGBM, GPU-assisted |
| TLS | self-signed, local | real certificate at nginx |
| Data | seed/demo data | migrated customer data |
| Object storage | MinIO container | MinIO container, encrypted volume |
| Secrets | `.env.development` (git-ignored) | injected at deploy, never in the repo |

### 2.1 The language model must be swappable by configuration

Build a provider abstraction in `ai-service/` so the model is never referenced directly by feature code.

```
ai-service/src/language_model/
├── language_model_provider.py      # abstract interface — all features use this
├── ollama_provider.py              # concrete implementation
├── model_profiles.py               # llama-development, qwen-production
└── prompt_templates/
    ├── assistant_english.txt
    └── assistant_arabic.txt
```

Switching models is a single environment variable:

```bash
LANGUAGE_MODEL_PROFILE=llama-development     # now
LANGUAGE_MODEL_PROFILE=qwen-production       # after the device arrives
```

No feature code names a model. Ever.

### 2.2 Known limitation of the development model — read this

**Llama 3.2 3B produces poor Arabic.** It is adequate for building and testing the *workflow* — request routing, retrieval, response shaping, error handling — but its Arabic output is not representative of what will ship.

Therefore:

- Build and validate the full assistant pipeline on Llama.
- Treat Arabic assistant output during development as **unverified**.
- Mark it in the UI during development builds only: a small "development model" badge on assistant responses. This must not appear in production builds.
- **Gate:** before UAT, re-run the full assistant test suite against Qwen 2.5 14B and manually review Arabic quality. Record the result in `documentation/security-compliance/`. Do not present the assistant to the client on the development model.

This limitation applies **only** to the conversational assistant. It does not affect replenishment reasoning, which is template-generated from real numbers (§8.3) and is identical on both models.

### 2.3 What must not differ between environments

Database schema, API contracts, business logic, security controls, audit logging, the design system, translations. If these diverge between development and production, the DESC evidence gathered during development is worthless.

---

## 3. Repository structure

Folders and files are named so that a person who has never seen the project can tell what is inside. **No abbreviations. No `utils`, `helpers`, `misc`, `common`, `stuff`, `temp`.**

```
mizan-inventory-system/
│
├── CLAUDE.md                          ← this specification
├── PROGRESS.md                        ← current status, you maintain this
├── OPEN-QUESTIONS.md                  ← unresolved decisions, you maintain this
├── README.md                          ← how to run the project
│
├── docker-compose.development.yml     ← laptop environment
├── docker-compose.production.yml      ← on-premise server environment
│
├── frontend/                          ← React web application (desktop + tablet)
├── backend/                           ← NestJS API and business logic
├── ai-service/                        ← Python AI, forecasting and assistant
│
├── shared/                            ← used by more than one application
│   ├── design-tokens/                 colours, typography, spacing
│   ├── translations/                  english.json, arabic.json
│   └── data-contracts/                Zod schemas + TypeScript types
│
├── database/
│   ├── schema/                        Prisma schema
│   ├── migrations/                    generated migrations
│   └── seed-data/                     store rooms, racks, levels, demo products
│
├── infrastructure/
│   ├── nginx/                         reverse proxy and TLS configuration
│   ├── docker/                        Dockerfiles per service
│   └── environment-templates/         .env.example files, never real secrets
│
├── documentation/
│   ├── security-compliance/           DESC evidence — see §11.3
│   ├── api-reference/                 generated OpenAPI output
│   ├── administrator-guide/
│   └── store-keeper-guide/
│
└── scripts/
    ├── generate-location-barcodes.ts
    ├── import-products-from-excel.ts
    └── create-first-administrator.ts
```

### 3.1 Inside `frontend/`

```
frontend/
├── public/
│   └── fonts/                         self-hosted IBM Plex (no external CDN)
└── src/
    ├── main.tsx
    ├── application-shell/             navigation rail, top bar, status strip
    ├── features/                      one folder per business capability
    │   ├── authentication/
    │   ├── product-catalogue/
    │   ├── storage-locations/
    │   ├── barcode-scanning/
    │   ├── stock-movements/
    │   ├── cycle-counting/
    │   ├── replenishment-approvals/
    │   ├── purchase-orders/
    │   ├── suppliers/
    │   ├── dashboard/
    │   ├── reports/
    │   ├── audit-log/
    │   └── user-management/
    ├── design-system/                 components built from the tokens
    │   ├── data-table/
    │   ├── location-designator/       ← the signature element, §9.6
    │   ├── stock-status-indicator/
    │   ├── buttons/
    │   ├── form-fields/
    │   └── theme-provider/
    ├── internationalisation/          language switching, direction handling
    ├── offline-queue/                 IndexedDB outbox and synchronisation
    └── api-client/                    typed calls to the backend
```

Each feature folder holds its own pages, components, hooks and tests. Keep related code together.

### 3.2 Inside `backend/`

```
backend/src/
├── main.ts
├── modules/                           one module per business capability
│   ├── authentication/
│   ├── users/
│   ├── products/
│   ├── storage-locations/
│   ├── stock-movements/
│   ├── cycle-counting/
│   ├── replenishment/
│   ├── purchase-orders/
│   ├── suppliers/
│   ├── reports/
│   ├── barcode-labels/
│   └── audit-log/
├── security/                          guards, DESC controls, rate limiting
├── database/                          Prisma client and transaction helpers
├── email/                             SMTP dispatch
├── file-storage/                      MinIO
└── ai-service-client/                 typed calls to ai-service
```

Each module: `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schema.ts`, `*.spec.ts`.

### 3.3 Inside `ai-service/`

```
ai-service/src/
├── main.py
├── replenishment/
│   ├── daily_review_job.py            scheduled run
│   ├── reorder_calculator.py          deterministic logic, §8.2
│   └── reasoning_generator.py         bilingual explanation templates
├── demand_forecasting/                Stage 2
│   ├── consumption_history.py
│   ├── seasonal_analyser.py
│   └── forecast_models.py
├── assistant/
│   ├── query_router.py                classify intent
│   ├── inventory_data_retriever.py    fetch real data from backend
│   └── response_composer.py           model phrases retrieved data only
├── language_model/                    §2.1 — provider abstraction
└── shared/
    ├── configuration.py
    └── logging_setup.py
```

### 3.4 File naming rules

- Folders and files: `kebab-case`. React components: `PascalCase.tsx`.
- Names describe purpose, not type: `reorder-calculator.ts`, not `calc.ts` or `logic.ts`.
- Backend suffixes: `.controller.ts`, `.service.ts`, `.repository.ts`, `.schema.ts`, `.guard.ts`, `.spec.ts`.
- Frontend suffixes: `.component.tsx`, `.hook.ts`, `.test.tsx`.
- Python: `snake_case.py`, describing what it does — `daily_review_job.py`, not `job.py`.
- A file a new engineer cannot identify from its name alone is misnamed.

**Good:** `barcode-scanner-listener.hook.ts` · `purchase-order-pdf-generator.service.ts` · `location-designator.component.tsx` · `reorder_calculator.py`
**Bad:** `useScanner.ts` · `pdfGen.ts` · `designator.tsx` · `calc.py` · `index.ts` holding logic

---

## 4. Technology stack

Locked. Do not substitute without recording the reason in `OPEN-QUESTIONS.md`.

### Frontend

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript (strict) |
| Build | Vite |
| Routing | React Router v6 |
| Server state | TanStack Query v5 |
| Tables | TanStack Table v8 |
| Client state | Zustand — theme, language, offline queue only |
| Styling | Tailwind CSS, **custom token config, default palette disabled** |
| Forms | React Hook Form + Zod |
| Translation | react-i18next |
| Charts | Recharts |
| Icons | Lucide React, 1.5px stroke, 18px default |
| Offline storage | Dexie (IndexedDB) |
| Fonts | IBM Plex Sans / Sans Arabic / Mono, self-hosted |

### Backend

| Concern | Choice |
|---|---|
| Framework | NestJS 10 (TypeScript, strict) |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Cache / queue | Redis 7 + BullMQ |
| Authentication | Passport JWT (access + refresh), argon2id |
| Multi-factor | TOTP implemented, disabled by default (§11) |
| Validation | Zod via `nestjs-zod`, shared with frontend |
| Barcode generation | `bwip-js` (Code128) |
| PDF | PDFKit |
| Excel | ExcelJS |
| Email | Nodemailer (on-premise SMTP relay) |
| Logging | Pino, JSON structured |
| API documentation | `@nestjs/swagger` → OpenAPI |

### AI service

| Concern | Choice |
|---|---|
| Framework | FastAPI + Pydantic v2 |
| Scheduling | APScheduler |
| Data | pandas, NumPy |
| Forecasting (Stage 2) | statsmodels → LightGBM |
| Model runtime | Ollama (local, no external calls) |
| Model — development | `llama3.2:3b-instruct-q4_K_M` |
| Model — production | `qwen2.5:14b-instruct-q4_K_M` |
| Embeddings | sentence-transformers, multilingual |
| Vector search | FAISS flat index |

### Authentication decision

Use **in-application JWT authentication**, not Keycloak. Five users, email and password, on-premise. Keycloak's operational burden is not justified at this scale, and every DESC control below is satisfiable in-application. Build the MFA capability now so it can be enabled for certification without rework.

---

## 5. Data model

Prisma schema in `database/schema/`.

```prisma
enum Role            { ADMIN STORE_KEEPER }
enum MovementType    { GOODS_IN GOODS_OUT TRANSFER CYCLE_COUNT ADJUSTMENT }
enum BarcodeSource   { MANUFACTURER INTERNAL }
enum RecommendationStatus { PENDING APPROVED AMENDED REJECTED ORDERED RECEIVED }

model User {
  id                String   @id @default(cuid())
  email             String   @unique
  passwordHash      String
  displayName       String
  role              Role
  preferredLanguage String   @default("en")
  preferredTheme    String   @default("system")
  isActive          Boolean  @default(true)
  mfaSecret         String?
  failedLoginCount  Int      @default(0)
  lockedUntil       DateTime?
  lastLoginAt       DateTime?
  createdAt         DateTime @default(now())
}

model Organization {
  id               String   @id @default(cuid())
  code             String   @unique          // e.g. "DEMO"
  nameEn           String
  nameAr           String
  timezone         String   @default("Asia/Dubai")
  defaultLanguage  String   @default("en")
  logoObjectKey    String?
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
}
// One row for a single-customer deployment. Present from day one so the
// platform can serve multiple customers later without a schema migration.
// Every tenant-owned row below carries organizationId.

model LocationType {
  id             String  @id @default(cuid())
  organizationId String
  code           String                       // SITE WAREHOUSE STORE_ROOM ZONE AISLE RACK LEVEL BIN
  nameEn         String                       // "Store Room"
  nameAr         String
  depth          Int                          // 0 = top of the tree
  canHoldStock   Boolean @default(false)      // true only for the level that stores goods
  codePattern    String?                      // optional validation, e.g. "^SR\\d+$"
  sortOrder      Int     @default(0)
  isActive       Boolean @default(true)
  @@unique([organizationId, code])
}
// Location types are DATA, not code. A customer with warehouses configures
// SITE > WAREHOUSE > AISLE > RACK > LEVEL > BIN. A store-room customer configures
// STORE_ROOM > RACK > LEVEL. Nothing in the application hardcodes either.

model LocationNode {
  id             String   @id @default(cuid())
  organizationId String
  parentId       String?                      // null = root node
  locationTypeId String
  code           String                       // "SR1", "R1", "L1"
  nameEn         String?
  nameAr         String?
  materialisedPath String                     // "/rootId/childId/leafId" — fast subtree queries
  designator     String                       // cached: "SR1-R1-L1" — recomputed on move or rename
  depth          Int
  barcode        String?  @unique             // present only when the type canHoldStock
  isActive       Boolean  @default(true)
  sortOrder      Int      @default(0)
  createdAt      DateTime @default(now())
  @@unique([parentId, code])
  @@index([organizationId, designator])
  @@index([materialisedPath])
}
// A single self-referencing tree of arbitrary depth replaces the old
// StoreRoom / Rack / Level tables. One store room or fifty warehouses use
// the same structure. The designator is the ancestor codes joined by "-".

model ProductCategory {
  id               String  @id @default(cuid())
  organizationId   String
  parentId         String?                    // categories nest to any depth
  code             String
  nameEn           String
  nameAr           String
  materialisedPath String
  sortOrder        Int     @default(0)
  isActive         Boolean @default(true)
  @@unique([organizationId, code])
}

model UnitOfMeasure {
  id               String  @id @default(cuid())
  organizationId   String
  code             String                     // "UNIT" "BOX" "CARTON" "KG" "LITRE"
  nameEn           String
  nameAr           String
  isBaseUnit       Boolean @default(false)
  @@unique([organizationId, code])
}

model ProductAttributeDefinition {
  id             String  @id @default(cuid())
  organizationId String
  key            String                       // "brand", "voltage", "shelfLifeDays"
  labelEn        String
  labelAr        String
  dataType       String                       // TEXT NUMBER BOOLEAN DATE SELECT
  selectOptions  Json?                        // for SELECT
  isRequired     Boolean @default(false)
  sortOrder      Int     @default(0)
  @@unique([organizationId, key])
}
// Different customers stock different things. Rather than shipping a fixed
// product schema, each deployment defines the extra fields it needs.

model Product {
  id               String        @id @default(cuid())
  organizationId   String
  sku              String
  barcode          String        @unique
  barcodeSource    BarcodeSource
  nameEn           String
  nameAr           String
  categoryId       String?
  baseUnitId       String                     // → UnitOfMeasure
  packSize         Int           @default(1)
  reorderPoint     Int
  minLevel         Int
  maxLevel         Int
  supplierId       String?
  customAttributes Json?                      // validated against ProductAttributeDefinition
  isActive         Boolean       @default(true)
  @@unique([organizationId, sku])
}

model StockPosition {
  id             String   @id @default(cuid())
  productId      String
  locationNodeId String                       // must be a node whose type canHoldStock
  quantity       Int
  updatedAt      DateTime @updatedAt
  @@unique([productId, locationNodeId])
}

model StockMovement {
  id          String       @id @default(cuid())
  clientId    String       @unique      // idempotency key from the device
  type                 MovementType
  productId            String
  fromLocationNodeId   String?
  toLocationNodeId     String?
  quantity             Int
  reason      String?                   // mandatory for ADJUSTMENT
  userId      String
  createdAt   DateTime     @default(now())
  @@index([productId, createdAt])
  @@index([createdAt])
}

model Supplier {
  id           String  @id @default(cuid())
  name         String
  email        String
  phone        String?
  leadTimeDays Int
  isActive     Boolean @default(true)
}

model Recommendation {
  id              String   @id @default(cuid())
  productId       String
  suggestedQty    Int
  approvedQty     Int?
  reasonCode      String   // BELOW_REORDER_POINT | FORECAST_DEPLETION | SEASONAL_UPLIFT
  reasoningEn     String
  reasoningAr     String
  status          RecommendationStatus @default(PENDING)
  generatedAt     DateTime @default(now())
  decidedByUserId String?
  decidedAt       DateTime?
  purchaseOrderId String?
}

model PurchaseOrder {
  id         String   @id @default(cuid())
  poNumber   String   @unique          // PO-2026-0001
  supplierId String
  status     String                    // DRAFT SENT RECEIVED
  pdfKey     String?
  sentAt     DateTime?
  createdAt  DateTime @default(now())
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  action     String
  entityType String
  entityId   String
  before     Json?
  after      Json?
  ipAddress  String?
  createdAt  DateTime @default(now())
  @@index([createdAt])
  @@index([entityType, entityId])
}
```

**`AuditLog` and `StockMovement` are append-only.** Add a PostgreSQL rule in Phase 0 rejecting `UPDATE` and `DELETE` on both tables. This is a DESC control and the migration is itself evidence — save it to `documentation/security-compliance/`.

Seed: 2 store rooms × 6 racks × 5 levels = 60 locations with generated barcodes.

---

## 5A. Configurable hierarchy and catalogue (product capability)

This system is being built as a **reusable product**, not a one-off for a single customer. Nothing about the
storage structure, the product catalogue or the vocabulary may be hardcoded.

### 5A.1 The rule

> Any customer must be able to model their own storage — one store room, ten store rooms, or
> several warehouses with aisles and bins — through the administration interface, without a
> developer, a migration or a code change.

If you find yourself writing `if (type === 'STORE_ROOM')` anywhere in the codebase, stop. That
is a configuration value, not a branch.

### 5A.2 How the tree works

`LocationType` defines the *shape* a customer uses. `LocationNode` holds the actual places.

| Customer | Configured location types | Resulting designator |
|---|---|---|
| A store-room customer | `STORE_ROOM > RACK > LEVEL` | `SR1-R1-L1` |
| A hospital | `BUILDING > FLOOR > ROOM > CABINET > SHELF` | `B2-F3-R12-C4-S2` |
| A distribution centre | `SITE > WAREHOUSE > AISLE > RACK > LEVEL > BIN` | `JEB-WH2-A7-R3-L2-B4` |

Rules:

- Depth is arbitrary. Do not assume three levels anywhere.
- `canHoldStock` marks which type actually stores goods. Only those nodes get a barcode and
  can hold a `StockPosition`. Everything above is structure.
- `designator` is the ancestor `code` values joined by `-`, computed on write and cached.
  Recompute the whole subtree when a node is renamed or moved.
- `materialisedPath` makes subtree queries a single indexed `LIKE '/parentId/%'` — never
  recurse in application code.
- `@@unique([parentId, code])` — codes are unique among siblings, not globally. Two store
  rooms may each have an `R1`.
- Deactivate, never delete. A location that has ever held stock is referenced by movement
  history and must survive for audit.

### 5A.3 Administration — storage structure

Build in `frontend/src/features/storage-locations/`. This is Administrator-only.

**Location type configuration**
- Define the hierarchy for this deployment: add, rename, reorder, set `canHoldStock`
- Bilingual names per type — one customer sees "Store Room", another customer sees "Warehouse"
- Optional code pattern validation per type
- Locked once nodes exist at that depth, to protect existing data

**Location tree management**
- A real tree view: expand, collapse, search, drag to reorder
- Add a child node at any level, respecting the configured type sequence
- Rename, deactivate, and move a subtree (with designator recomputation)
- Show stock count and item count on every node, rolled up from descendants

**Bulk creation — this is what makes it usable**

Nobody will click sixty times to create sixty shelves. Provide a generator:

```
Create under:  SR1 (Store Room 1)
  Racks:   R1 … R6        prefix [R]  from [1] to [6]
  Levels:  L1 … L5        prefix [L]  from [1] to [5]
  → creates 6 racks, each with 5 levels = 30 nodes, 30 barcodes
  [Preview]  shows the full list of designators before committing
```

Always preview before committing. Always offer batch barcode label printing for whatever
was just created.

**Import and export**
- Import a structure from Excel (columns: parent designator, type code, code, names)
- Export the current structure to Excel — this is how a customer is onboarded quickly

### 5A.4 Administration — product catalogue

Build in `frontend/src/features/product-catalogue/`. Administrator-only.

- **Categories**: a nesting tree, same pattern as locations — add, rename, reorder, deactivate
- **Units of measure**: define per deployment; one flagged as the base unit
- **Custom attributes**: define extra product fields (text, number, boolean, date, select)
  with bilingual labels. Product forms render these dynamically; validation is driven by the
  definitions, never hardcoded.
- **Products**: create, edit, deactivate; assign category, base unit, pack size, reorder point,
  min/max levels, supplier
- **Bulk import** from Excel with a downloadable template, a dry-run validation pass and a
  row-by-row error report. Never import a partially valid file silently.
- **Bulk edit** — select many products, set category, supplier or reorder point together

### 5A.5 Vocabulary is configurable

Do not hardcode the words "store room", "rack" or "level" in the interface. Every label comes
from the `LocationType` record's `nameEn` / `nameAr`. Translation files carry generic strings:

```
"locations.addChild": "Add {{typeName}}"        → "Add Rack" / "Add Aisle"
"locations.emptyState": "No {{typeName}} yet"
```

### 5A.6 What is deliberately NOT built now

These are product features that do not serve the current deployment and must not consume MVP time:

- Multi-tenant data isolation (row-level security, tenant-scoped connections)
- Customer self-service sign-up or onboarding
- White-labelling beyond the organisation logo and name
- Licensing, entitlement or metering
- Cross-customer reporting or a management console

`organizationId` exists on every tenant-owned table from day one so these become possible
later without a painful migration. **Scope them, do not build them.**

## 6. Barcode scanning

**The detail most likely to be got wrong. Read carefully.**

The scanner is a wireless unit paired to a tablet, operating in **HID keyboard-wedge mode**: it types the barcode rapidly and sends `Enter`. There is no SDK, no Bluetooth API, no camera.

Implementation in `frontend/src/features/barcode-scanning/`:

- Distinguish scanner input from human typing by **speed** — a scanner emits characters under 30 ms apart, a human cannot. Buffer keystrokes, flush on `Enter` or 100 ms idle.
- A global listener active on scanning screens — **no focused input required**. The Store Keeper must not have to tap a field first.
- A visible manual-entry field as fallback for damaged labels or a flat battery.
- Debounce duplicate scans of the same code within 1500 ms.
- Distinct audio and haptic feedback for accepted, rejected and duplicate. The store room is noisy; feedback must be unambiguous.
- **Location-first flow:** scan a location → it becomes the active context shown in the designator strip (§9.6) → then scan products repeatedly against it. Someone working one shelf scans the location once, not once per item.

### Offline operation

Wi-Fi in the store rooms is not guaranteed. Every movement must be queueable.

- Write scans to the IndexedDB outbox immediately, then synchronise.
- Show queue depth in the status strip (§9.7) at all times.
- Synchronise automatically on reconnect, in order.
- Each movement carries a client-generated UUID; the API is idempotent on `clientId`.
- Never silently drop a queued scan. Failures surface in a review list.

---

## 7. API surface

REST at `/api/v1`, OpenAPI-documented, JWT bearer auth, Zod-validated at every boundary.

```
POST   /auth/login                    → access + refresh tokens
POST   /auth/refresh
POST   /auth/logout

GET    /products                      ?search, categoryId, lowStock
POST   /products                      (ADMIN) generates internal barcode if absent
GET    /products/:id
PATCH  /products/:id                  (ADMIN)
PATCH  /products/bulk                 (ADMIN) bulk edit
GET    /products/:id/stock            positions across all locations
POST   /products/import               (ADMIN) Excel, supports ?dryRun=true
GET    /products/import-template      downloadable Excel template

GET    /product-categories            tree
POST   /product-categories            (ADMIN)
PATCH  /product-categories/:id        (ADMIN)

GET    /units-of-measure              POST /units-of-measure         (ADMIN)
GET    /product-attributes            POST /product-attributes       (ADMIN)

GET    /organization                  current deployment settings
PATCH  /organization                  (ADMIN) name, logo, timezone, default language

GET    /location-types                 configured hierarchy shape
POST   /location-types                 (ADMIN)
PATCH  /location-types/:id             (ADMIN)

GET    /storage-locations              ?parentId, depth, search — returns tree or subtree
POST   /storage-locations              (ADMIN) create one node
POST   /storage-locations/bulk-create  (ADMIN) generator, §5A.3 — supports ?preview=true
PATCH  /storage-locations/:id          (ADMIN) rename / deactivate
POST   /storage-locations/:id/move     (ADMIN) reparent subtree, recompute designators
GET    /storage-locations/resolve/:barcode
GET    /storage-locations/:id/stock    ?includeDescendants=true
POST   /storage-locations/import       (ADMIN) Excel
GET    /storage-locations/export       Excel

POST   /stock-movements               idempotent on clientId
GET    /stock-movements               ?type, productId, locationId, from, to, userId

POST   /cycle-counts
POST   /cycle-counts/:id/scan
POST   /cycle-counts/:id/close        → variance report

GET    /recommendations               ?status
POST   /recommendations/:id/approve   { approvedQty? }
POST   /recommendations/:id/reject    { reason }
POST   /recommendations/run           (ADMIN) trigger review manually

GET    /purchase-orders
GET    /purchase-orders/:id/pdf

GET    /suppliers   POST /suppliers   PATCH /suppliers/:id     (ADMIN)

GET    /dashboard/summary
GET    /reports/stock-on-hand         ?format=pdf|xlsx
GET    /reports/stock-movements       ?format=pdf|xlsx
GET    /reports/replenishment         ?format=pdf|xlsx

GET    /barcode-labels/product/:id
GET    /barcode-labels/location/:id
POST   /barcode-labels/batch

GET    /audit-log                     (ADMIN) ?entityType, entityId, actorId, from, to
POST   /assistant/query               { text, language } → answer + sources
GET    /users   POST /users   PATCH /users/:id                 (ADMIN)
```

Backend ↔ AI service communicate on the internal Docker network only, never exposed through nginx.

---

## 8. AI Store Manager

### 8.1 Daily job

APScheduler, default 07:00 Gulf Standard Time, configurable. For each active product: read current stock, compute consumption rate, read supplier lead time, decide (§8.2), generate bilingual reasoning, persist recommendations, notify the officer.

### 8.2 Reorder logic — deterministic

```
dailyUsage     = sum(GOODS_OUT quantity, trailing 30 days) / 30
leadTimeDemand = dailyUsage × supplier.leadTimeDays
safetyStock    = dailyUsage × 3
effectiveROP   = max(product.reorderPoint, leadTimeDemand + safetyStock)

if currentStock <= effectiveROP:
    suggestedQty = max(product.maxLevel - currentStock,
                       dailyUsage × supplier.leadTimeDays × 1.5)
    round up to nearest packSize
    reasonCode = BELOW_REORDER_POINT
```

Transparent, reproducible, defensible to an auditor. Stage 2 replaces `dailyUsage` with a forecast and adds the `FORECAST_DEPLETION` and `SEASONAL_UPLIFT` reason codes. **The interface does not change** — only the input.

### 8.3 Reasoning text

Every recommendation carries a plain-language explanation in both languages, generated from **templates filled with computed values — never by the language model**:

> "Stock is 12 units. Average use is 4 units per day and delivery takes 5 days, so stock will run out in about 3 days. Recommend ordering 48 units."

Deterministic, reproducible, cannot hallucinate, identical on Llama and Qwen. This is why the development model limitation (§2.2) does not affect procurement.

### 8.4 Assistant

Natural-language queries over stock. Architecture: classify intent → run a structured query against the backend → the model phrases an answer **from the real returned data**.

**The model never generates figures.** It formats retrieved values. Every numeric answer traces to a database row. Include the source values in the response payload so the UI can show them.

---

## 9. Design system

> Binding. The client has explicitly rejected generic, template-looking interfaces.

### 9.1 Design thesis

The subject is an aviation authority's store room. The most characteristic artifact in that world is the **position designator** — `SR1-R1-L1`. Aviation runs on coded positions: gates, stands, runways. That is where this interface takes its identity — not decorative aircraft imagery, but the *typographic discipline of aviation wayfinding*: segmented codes, monospaced figures, high contrast, unambiguous at arm's length.

The interface is an **instrument**, not a brochure. Dense, quiet, precise. One bold element; everything else disciplined.

### 9.2 Prohibited — these make work look machine-generated

- ❌ Purple, indigo or violet primaries
- ❌ Gradients anywhere
- ❌ Glassmorphism, blur-behind, translucent panels
- ❌ Emoji as icons
- ❌ Pill-shaped or capsule buttons (radius ≥ half the element's height) — see §9.5 for the (now pronounced) corner radius itself
- ❌ Drop shadows on resting elements
- ❌ Card grids where a table belongs
- ❌ Cream backgrounds with terracotta accents
- ❌ Near-black backgrounds with a single acid accent
- ❌ Inter, Roboto or system-ui as primary typeface
- ❌ Default Tailwind palette — disable it in configuration
- ❌ Centred hero sections, marketing layouts, decorative illustration

### 9.3 Typography

Self-hosted in `frontend/public/fonts`. No external font CDN.

| Role | Family | Weights |
|---|---|---|
| Interface, Latin | **IBM Plex Sans** | 400, 500, 600 |
| Interface, Arabic | **IBM Plex Sans Arabic** | 400, 500, 600 |
| Data and designators | **IBM Plex Mono** | 400, 500 |

Chosen because Plex is institutional rather than fashionable, and Plex Sans Arabic is drawn by the same foundry — switching language keeps colour, weight and rhythm consistent. Most pairings collapse in Arabic; this one does not.

```
--text-2xs    11px / 16px   uppercase labels, letter-spacing 0.06em
--text-xs     12px / 18px   table meta, captions
--text-sm     13px / 20px   table body, dense interface  ← default for data
--text-base   15px / 24px   body copy
--text-lg     18px / 26px   section headings
--text-xl     22px / 30px   page titles
--text-2xl    28px / 36px   dashboard figures
--designator  34px / 1.0    designator strip (mono, 500)
```

**All numerals use `font-variant-numeric: tabular-nums`.** Quantities in a column must align.

### 9.4 Colour

Institutional deep teal — aviation instrumentation and government authority, distinct from the blue every admin template uses. Muted gold appears only on the designator and genuine emphasis. Semantic colours carry stock state, which is functional.

Defined once in `shared/design-tokens/`, consumed as CSS custom properties.

**Light theme**

```css
--canvas:          #F4F6F7;
--surface:         #FFFFFF;
--surface-sunken:  #EDF1F2;
--hairline:        #D6DEE2;
--hairline-strong: #B9C6CC;

--ink:             #0D1B22;
--ink-muted:       #566A75;
--ink-faint:       #8497A0;

--primary:         #0B4F5E;
--primary-hover:   #08404C;
--primary-soft:    #E1EDF0;
--on-primary:      #FFFFFF;

--gold:            #A67C1A;
--gold-soft:       #F7EFDC;

--ok:              #1E6B45;   --ok-soft:       #E3F1E9;
--warn:            #8A5A00;   --warn-soft:     #FAF0DC;
--critical:        #9B2226;   --critical-soft: #F9E5E5;
--info:            #0B4F5E;   --info-soft:     #E1EDF0;
--focus:           #0B4F5E;
```

**Dark theme** — "Graphite": neutral warm-grey panels with a teal-cyan accent, *not* black. Instrument panel at night. (Selected by the client over the original teal-slate; the two are interchangeable — only these token values differ.)

```css
--canvas:          #141518;
--surface:         #1C1E22;
--surface-sunken:  #0F1013;
--hairline:        #2E3138;
--hairline-strong: #43474F;

--ink:             #E8E9EC;
--ink-muted:       #9CA0A8;
--ink-faint:       #6E727B;

--primary:         #46A9BE;
--primary-hover:   #59BCCF;
--primary-soft:    #12292F;
--on-primary:      #06171B;

--gold:            #D9AC4B;
--gold-soft:       #2A2315;

--ok:              #52AC7E;   --ok-soft:       #142A21;
--warn:            #D4A23E;   --warn-soft:     #2A2315;
--critical:        #E06A6E;   --critical-soft: #2E1719;
--info:            #46A9BE;   --info-soft:     #12292F;
--focus:           #6FC6D8;
```

Every text/background pair must meet **WCAG 2.1 AA (4.5:1)**. Verify with a contrast checker — government accessibility requirement, and DESC evidence.

### 9.5 Geometry and space

```
--radius-sm: 8px    inputs, chips
--radius-md: 14px   buttons, panels     ← default
--radius-lg: 20px   modals
```

Revised client decision, 2026-09-23: corners are now pronounced and clearly
visible — a deliberate departure from the original 4px cap. Every surface is
still a rectangle; the curve is a corner treatment, never enough to read as a
pill or capsule (§9.2 still bans that on buttons, tab pills, badges, etc.).

8px grid: `4 8 12 16 24 32 48 64`.

**Separation uses hairline borders, not shadows.** Shadows only on genuinely floating layers (modal, dropdown, toast), kept tight: `0 2px 8px rgb(0 0 0 / 0.12)`.

### 9.6 Signature element — the location designator strip

**The one bold move. Everything else stays quiet.**

When a Store Keeper scans a location, it renders full-width as a segmented designator styled after gate signage — large monospace, each segment in its own cell divided by hairlines, gold rule beneath.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│    SR1   │   R1   │   L1          COFFEE STORE · ROOM 1  │
│  ────────────────────────────────────────────────────    │  ← 2px gold rule
│                                                          │
│  47 items on this shelf              Scanning: active ●  │
└──────────────────────────────────────────────────────────┘
```

- Segments in IBM Plex Mono 500, `--designator` size, `letter-spacing: 0.04em`
- Vertical hairline dividers in `--hairline-strong`
- 2px `--gold` rule beneath the segment row only
- Room name right-aligned, `--text-2xs`, uppercase, tracked, `--ink-muted`
- Before any scan: cells show `———` in `--ink-faint`
- On scan: 120 ms fade. No slide, no bounce. Respect `prefers-reduced-motion`.
- In RTL the segment **order reverses** (`L1 │ R1 │ SR1`) but each segment's text stays LTR — codes are never translated

**Variable depth — the component takes an array of segments, never three fixed values.**
Hierarchies range from two levels to six (§5A.2). Rendering rules:

- 2–4 segments: show all, full `--designator` size
- 5 segments: show all, drop to 28px
- 6 or more: show the first segment, an ellipsis cell `⋯`, then the final three. The leaf is
  always visible — it is what the operator is standing in front of. Hovering or tapping the
  ellipsis reveals the full path.
- The small table chip follows the same rule but shows only the last two segments plus a
  tooltip carrying the full designator

The same designator at small size is the location chip used throughout tables:

```
┌─────┬────┬────┐
│ SR1 │ R1 │ L1 │    mono, --text-xs, 2px radius
└─────┴────┴────┘
```

### 9.7 Layout

```
┌────┬─────────────────────────────────────────────────────┐
│    │  Top bar: page title · search · theme · language    │
│ N  ├─────────────────────────────────────────────────────┤
│ A  │                                                     │
│ V  │  Content — tables, panels, designator strip          │
│    │                                                     │
│ R  │                                                     │
│ A  │                                                     │
│ I  │                                                     │
│ L  ├─────────────────────────────────────────────────────┤
│    │  Status strip: sync · queue: 0 · SR1 · 09:42 GST    │
└────┴─────────────────────────────────────────────────────┘
```

- **Navigation rail** fixed, 220px, collapses to 56px icons. Not a hamburger — navigation stays visible.
- **Status strip** persistent, 32px, bottom. Connection state, offline queue depth, active store room, clock. It is how the Store Keeper trusts scans are saving. Never hide it.
- Content max-width 1440px, 24px gutters.
- Tablet (768–1024px): rail auto-collapses, tap targets ≥ 44px, designator strip grows.

### 9.8 Components

**Tables are the primary interface**, not card grids.

- Row height 40px, with a 32px compact toggle
- Header: `--text-2xs`, uppercase, tracked, `--surface-sunken`, sticky
- Horizontal hairlines only — no vertical rules, no zebra striping
- Numeric columns right-aligned, tabular figures
- Hover `--surface-sunken`; selected `--primary-soft` with a 2px inline-start `--primary` border
- Empty state: one line of instruction plus the primary action. No illustration.

**Buttons** — 32/36/44px, `--radius-md`, weight 500, `--text-sm`. Primary filled, secondary outlined, ghost transparent, destructive `--critical`. No icon-only buttons without `aria-label` and tooltip.

**Stock status** — a 6px square plus a text label. Never colour alone.

```
■ In stock (--ok)   ■ Low (--warn)   ■ Critical (--critical)   □ Out (--ink-faint)
```

**Forms** — labels above fields, `--text-xs`, `--ink-muted`. Inputs 36px, hairline border. Focus 2px `--focus` outline with 1px offset, always visible. Errors below the field stating what to do.

**Charts** — token colours only, no gradient fills, hairline grid, mono tabular axis figures.

### 9.9 Motion

120–180 ms, `cubic-bezier(0.2, 0, 0.2, 1)`. Permitted: designator fade, row hover, focus ring, toast, skeleton. Not permitted: page transitions, parallax, scroll reveals, animated counters, bouncing. Respect `prefers-reduced-motion`.

---

## 10. Bilingual — English and Arabic

Both are MVP scope. English primary; Arabic complete, not partial.

- `react-i18next`, files in `shared/translations/`
- Set `<html lang dir>` on switch; persist to the user profile and localStorage
- **Use CSS logical properties throughout** — `margin-inline-start`, `padding-inline-end`, `border-inline-start`. Never `left`/`right` for layout.
- Tailwind: `ms-*` / `me-*` / `ps-*` / `pe-*`, never `ml-*` / `mr-*`
- Directional icons mirror in RTL; logos, clocks and media controls do not
- Charts mirror axis placement in RTL
- **Never translate or mirror** location designators, SKUs, barcodes or PO numbers. Wrap in `<bdi>` or `dir="ltr"`.
- Numerals: Western Arabic (0–9) in both languages, consistent with barcode data
- Dates: Gregorian, `DD/MM/YYYY`, Gulf Standard Time (UTC+4)
- Products carry `nameEn` and `nameAr`; fall back to the other language with a subtle marker rather than blank
- PDF and Excel exports are English-only for MVP

Add a `?pseudo=1` mode that lengthens strings 40% to catch layout breakage early.

---

## 11. DESC compliance

> **Mandatory across every layer.** Not a final checkbox. Every phase produces both the control and its evidence.

### 11.1 Technical controls

| # | Control | Implementation |
|---|---|---|
| 1 | Encryption in transit | TLS at nginx, HSTS enabled, TLS 1.2 minimum |
| 2 | Encryption at rest | Encrypted PostgreSQL volume, MinIO server-side encryption |
| 3 | Password storage | argon2id, minimum 12 characters, common-password blocklist |
| 4 | Session management | JWT access 15 min, refresh 7 days, rotated, revocable via Redis denylist |
| 5 | Account lockout | 5 failed attempts → 15 minute lock, recorded in audit log |
| 6 | Idle timeout | 30 minutes, then re-authentication |
| 7 | Multi-factor | TOTP implemented, `MFA_ENABLED=false` until certification |
| 8 | Access control | Role guards at controller level, never trusted from the client |
| 9 | Audit logging | Every state change writes `AuditLog` in the same transaction |
| 10 | Log immutability | PostgreSQL rule blocking `UPDATE`/`DELETE` on `AuditLog`, `StockMovement` |
| 11 | Network segmentation | AI service and database unreachable from outside the Docker network |
| 12 | Rate limiting | Applied to all `/auth/*` endpoints |
| 13 | Secure headers | Helmet, strict Content-Security-Policy, no inline scripts |
| 14 | Secrets management | Environment only, never in the repository, `.env*` git-ignored |
| 15 | Log hygiene | No personal data in logs. User IDs only, never emails or passwords |
| 16 | Dependency scanning | `pnpm audit` and `pip-audit` in the build pipeline |
| 17 | Backup and recovery | Automated encrypted backups, documented and tested restore |
| 18 | Data residency | All data stored and processed on-premise |
| 19 | Least privilege | Database user holds only required grants; no superuser at runtime |
| 20 | Input validation | Zod at every boundary; parameterised queries only via Prisma |

### 11.2 Development-environment caveats

On the laptop, controls 1, 2 and 17 are implemented but not production-grade (self-signed certificate, unencrypted host volume, local backups). **Implement the code and configuration now**; note the environment gap in the compliance record. Never remove a control just because we are in development.

### 11.3 Evidence — generate as you build

Write to `documentation/security-compliance/` as each control is implemented. Reconstructing this at certification time is far harder.

```
documentation/security-compliance/
├── control-implementation-matrix.md      the table above + status + file references
├── data-flow-diagram.md                  what data moves where
├── encryption-configuration.md           in transit and at rest
├── access-control-model.md               roles, permissions, enforcement points
├── audit-logging-specification.md        what is logged, retention, immutability proof
├── backup-and-recovery-procedure.md      including a tested restore record
├── dependency-scan-reports/              dated build-pipeline output
├── accessibility-conformance-report.md   WCAG 2.1 AA results
└── language-model-validation.md          §2.2 Arabic quality gate result
```

Update `control-implementation-matrix.md` whenever a control lands. A control is not done until its evidence entry exists.

---

## 12. Business rules

1. **Stock cannot go negative.** Reject with a clear message.
2. **Adjustments require a reason** — minimum 10 characters.
3. **Transfers are atomic** — decrement and increment in one transaction.
4. **Cycle counts do not mutate stock directly.** They produce a variance report; applying it creates explicit `ADJUSTMENT` movements, each audited.
5. **Only ADMIN approves** recommendations and purchase orders.
6. **A rejected recommendation is not regenerated the same day** for the same product.
7. **Purchase orders group by supplier** — one per supplier per approval run.
8. **Every state change writes an audit record** in the same transaction.
9. **Pack conversion is display-only.** Store base units internally.

---

## 13. Build phases

### 13.1 Phase 0 — Foundation

Repository structure per §3, `docker-compose.development.yml`, Prisma schema and migrations
(**including `Organization`, `LocationType` and the `LocationNode` tree — §5A**), append-only
rules, seed data (demo organisation, `STORE_ROOM > RACK > LEVEL` types, 60 nodes, 50 demo
products), design tokens, translation scaffold in both languages, theme switching, application
shell (rail, top bar, status strip), authentication with JWT and role guards, health checks,
`.env.example` templates.

**Freeze the API contract (§7) in this phase.** It is what allows the frontend and backend
tracks to proceed in parallel.

**Done when:** `docker compose -f docker-compose.development.yml up` starts everything, a seeded
user logs in, the shell renders in both themes and both languages, preferences persist across
reload, and the seeded location tree renders from configuration rather than hardcoded types.

### 13.2 Phase 1 — Inventory core

**Administration of structure (§5A):** location type configuration, location tree management
with bulk creation and preview, category tree, units of measure, custom attribute definitions.

**Catalogue and stock:** product management, Excel import with dry-run, internal barcode
generation, label rendering and batch printing, stock positions, all five movement types,
scanning listener, depth-agnostic designator strip, offline outbox with synchronisation, stock
and location views.

**Done when:** an Administrator can define a hierarchy from scratch, bulk-create a full
structure, print its labels, and add products — and a Store Keeper can then scan a location,
scan products, and record every movement type, online and offline, with correct stock and
complete audit records.

**Product acceptance test:** configure a second, differently shaped hierarchy
(`SITE > WAREHOUSE > AISLE > RACK > BIN`) in a scratch organisation and confirm the entire
application works against it with no code change. If anything breaks, the generalisation is
incomplete.

### 13.3 Phase 2 — AI Store Manager

AI service, language-model provider abstraction (§2.1), daily scheduled review, reorder calculator, bilingual reasoning generator, recommendation list, approve/amend/reject, supplier management, PO generation, SMTP dispatch, notifications.

**Done when:** the daily job produces explained recommendations, an Administrator approves one, and a correct PO email reaches the supplier.

### 13.4 Phase 3 — Dashboard, reporting, hardening

Dashboard, PDF reports with charts, Excel exports, audit log viewer, user management, cycle-count sessions with variance, all DESC controls verified with evidence written, full accessibility pass, tablet layout verification, administrator and store keeper guides.

**Done when:** MVP scope is complete, tested, accessible, DESC evidence is filed, and it is deployed.

### 13.5 Stage 2 — after MVP acceptance

Move to the production environment and `qwen-production`, run the language-model validation
gate (§2.2), demand forecasting engine, seasonal configuration, forecast-driven
recommendations, mobile application, assistant refinement.

### 13.6 Product phase — after MVP go-live, commercially separate

Not part of the MVP engagement. Do not build during MVP or Stage 2.

Multi-tenant data isolation, customer onboarding, white-labelling, licensing and entitlement,
deployment automation per customer, a demonstration dataset, and product documentation.

Because `organizationId` is present on every tenant-owned table and every location type is
configuration rather than code, none of this requires reworking what was built for the first customer.

---

## 14. Conventions

**TypeScript** — `strict: true`, no `any`. Zod schemas in `shared/data-contracts/` are the single source of truth; derive types with `z.infer`.

**Naming** — `PascalCase` components, `camelCase` functions, `SCREAMING_SNAKE_CASE` constants. Booleans read as assertions: `isActive`, `hasStock`, `canApprove`. Follow §3.4 for files.

**NestJS** — one module per capability. Thin controllers, logic in services, data access in repositories.

**React** — function components and hooks. Colocate by feature. Server state lives in TanStack Query — never mirrored into Zustand.

**Python** — type hints throughout, Pydantic models at boundaries, `snake_case`.

**Git** — Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). Branches `feature/<phase>-<slug>`.

**Errors** — never swallowed. API returns `{ error: { code, messageEn, messageAr, details? } }`. The interface shows the localised message and the next step.

**Configuration over code** — before writing a conditional on a location type, product
category, unit or label, ask whether it belongs in the database instead. It almost always does.
Grep the codebase for `STORE_ROOM`, `RACK`, `LEVEL` and any literal depth of three before
finishing a feature; there should be no matches outside seed data and tests.

**Comments** — explain *why*, never *what*. Document business rules and domain quirks.

---

## 15. Testing

| Layer | Tool | Bar |
|---|---|---|
| Backend unit | Jest | ≥ 80% on services |
| Backend integration | Jest + Testcontainers | all endpoints |
| Frontend unit | Vitest + Testing Library | hooks and logic |
| End-to-end | Playwright | critical paths |
| AI service | pytest | reorder calculator ≥ 90% |
| Accessibility | axe-core in Playwright | zero violations |

Critical end-to-end paths: login → scan location → scan product → verify stock; offline scan → reconnect → verify synchronisation; recommendation → approve → PO emailed; language switch persists; theme switch persists.

**Always test both languages and both themes.** A visual defect in Arabic dark mode is still a defect.

---

## 16. Environment configuration

`infrastructure/environment-templates/.env.example` — commit this, never a real `.env`:

```bash
NODE_ENV=development
API_PORT=3000

DATABASE_URL=postgresql://mizan:CHANGEME@postgres:5432/mizan_inventory
REDIS_URL=redis://redis:6379

JWT_SECRET=CHANGEME
JWT_REFRESH_SECRET=CHANGEME
MFA_ENABLED=false
SESSION_IDLE_TIMEOUT_MINUTES=30
ACCOUNT_LOCKOUT_ATTEMPTS=5

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="Mizan Inventory <inventory@example.com>"

MINIO_ENDPOINT=minio
MINIO_ACCESS_KEY=CHANGEME
MINIO_SECRET_KEY=CHANGEME
MINIO_BUCKET=mizan-inventory

AI_SERVICE_URL=http://ai-service:8000
OLLAMA_URL=http://ollama:11434

# Language model — see §2.1. Switch profile, never edit feature code.
LANGUAGE_MODEL_PROFILE=llama-development
# LANGUAGE_MODEL_PROFILE=qwen-production

REPLENISHMENT_RUN_TIME=07:00
TZ=Asia/Dubai
DEFAULT_LANGUAGE=en
```

---

## 17. Definition of done

A feature is done when:

- [ ] Works in **English and Arabic**
- [ ] Works in **light and dark** themes
- [ ] Keyboard accessible, focus always visible
- [ ] Passes axe with zero violations
- [ ] Renders correctly at 1440px, 1024px and 768px
- [ ] Every user-facing string is in both translation files
- [ ] Uses only design tokens — no arbitrary colours, sizes or radii
- [ ] Errors handled and explained in the user's language
- [ ] Loading and empty states designed, not default
- [ ] Tests written and passing
- [ ] Audit record written for every state change
- [ ] **DESC evidence updated** in `documentation/security-compliance/`
- [ ] Folder and file names follow §3.4
- [ ] **No hardcoded location type, depth, count or vocabulary** — works against a differently
      shaped hierarchy (§5A)
- [ ] `PROGRESS.md` updated

---

## 18. When in doubt

1. **Correctness over cleverness.** This is a government system of record.
2. **Auditability over convenience.** If it changes state, it is logged.
3. **Legibility over density.** A Store Keeper reads this standing up, at arm's length, in imperfect light.
4. **Deterministic over generative.** AI explains and assists; it never decides procurement alone.
5. **Configuration over rewriting.** Anything that differs between laptop and server is an environment variable.
6. **Configuration over hardcoding.** Every deployment is a distinct customer. Anything specific to their
   storage layout, vocabulary or catalogue belongs in the database.
7. **Boring infrastructure.** Fewer moving parts is better at this scale.

Record genuine uncertainty in `OPEN-QUESTIONS.md`, take the conservative option, and keep moving.
