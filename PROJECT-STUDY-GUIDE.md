# Mizan — Complete Project Reference

> **The single, exhaustive reference for this project.** Everything: what it is, how it is built,
> every model, every endpoint, every screen, every decision, every gap.
>
> **Generated 2026-09-24** against the live repository and the live development database — every
> number and file path below was read from the actual system, not copied from an older document.
>
> **Companion documents** (this file summarises all of them; they remain authoritative in their own
> scope):
> - [`CLAUDE.md`](CLAUDE.md) — the **binding build specification**. If this file and CLAUDE.md
>   disagree, CLAUDE.md wins.
> - [`PROGRESS.md`](PROGRESS.md) — the dated, session-by-session build log with full detail.
> - [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) — unresolved decisions awaiting the client.
> - [`THINGS-TO-DO.md`](THINGS-TO-DO.md) — plain-language, non-engineer checklist.
> - [`HOW-TO-RUN.md`](HOW-TO-RUN.md) — step-by-step run instructions.

---

## Table of contents

1. [What Mizan is](#1-what-mizan-is)
2. [Status at a glance](#2-status-at-a-glance)
3. [The core business loop](#3-the-core-business-loop)
4. [Hardware and runtime environment](#4-hardware-and-runtime-environment)
5. [Technology stack](#5-technology-stack)
6. [Architecture and data flow](#6-architecture-and-data-flow)
7. [Repository structure](#7-repository-structure)
8. [Data model — every table, every field](#8-data-model--every-table-every-field)
9. [The configurable hierarchy — the product differentiator](#9-the-configurable-hierarchy--the-product-differentiator)
10. [Complete API surface](#10-complete-api-surface)
11. [Backend modules, one by one](#11-backend-modules-one-by-one)
12. [Frontend screens, one by one](#12-frontend-screens-one-by-one)
13. [Design system](#13-design-system)
14. [Bilingual — English and Arabic](#14-bilingual--english-and-arabic)
15. [The AI — three engines](#15-the-ai--three-engines)
16. [Business rules and where they are enforced](#16-business-rules-and-where-they-are-enforced)
17. [Security and DESC compliance](#17-security-and-desc-compliance)
18. [Testing](#18-testing)
19. [The demo dataset](#19-the-demo-dataset)
20. [Running the system](#20-running-the-system)
21. [Environment variables](#21-environment-variables)
22. [Version control state](#22-version-control-state)
23. [Open questions](#23-open-questions)
24. [Known gaps and what is deliberately not built](#24-known-gaps-and-what-is-deliberately-not-built)
25. [Roadmap](#25-roadmap)
26. [Key decisions and the reasoning behind them](#26-key-decisions-and-the-reasoning-behind-them)
27. [Glossary](#27-glossary)

---

## 1. What Mizan is

**Mizan** (ميزان — Arabic for *balance / scales*) is an **on-premise, AI-assisted inventory
management system** for stock rooms and warehouses, built by **Grow Plus Technologies**.

Four properties define it:

| Property | What it means |
|---|---|
| **A product, not a one-off** | Storage structure, product catalogue, and even the vocabulary are **configuration rows in the database, never code**. The same binary runs a coffee-and-stationery store room, a hospital dispensary, or a distribution centre with aisles and bins — with zero code changes. |
| **On-premise by design** | No cloud services. No external API calls at runtime. The only permitted outbound traffic is SMTP to email purchase orders to suppliers. This is the core selling point for government, defence, and regulated buyers: data residency and air-gap capability. |
| **Bilingual** | English and Arabic, both complete, with full right-to-left layout. Arabic is not a partial translation — it is a first-class mode, tested as part of "done" for every feature. |
| **DESC-compliant** | The 20 Dubai Electronic Security Center technical controls are designed into every layer, with evidence generated as each control lands, not reconstructed at certification time. |

**The governance rule that defines the product:**

> **The AI recommends; a human always approves.** The system never places an order autonomously.
> This is a hard requirement, not a preference.

---

## 2. Status at a glance

**Phases 0–3 (the full MVP) are functionally complete.** Stage 2 AI (the conversational assistant
and demand forecasting) is built and running natively on the Jetson. Productization work
(white-labelling, multi-entity provisioner, safe delete, Graphite dark theme) is done. The
Predictive Analytics dashboard and movement-history browsing were added on 2026-09-23.

### Codebase size (measured 2026-09-24)

| Area | Files | Lines |
|---|---:|---:|
| `backend/src` | 81 `.ts` | 4,251 |
| `frontend/src` | 44 `.ts`/`.tsx` | 4,652 |
| `ai-service/src` | 21 `.py` | 1,502 |
| `ai-service/tests` | 3 `.py` | 301 |
| `shared/` (tokens + translations) | 3 | 977 |
| `backend/prisma` (schema, seeds, migrations) | 6 | 1,274 |

### What is running right now

- **Backend** — NestJS on `:3000`, prefix `/api/v1`, OpenAPI docs at `/api/v1/docs`
- **Frontend** — Vite dev server on `:5173`
- **PostgreSQL 16.15** on `:5432`, database `mizan_inventory`
- **ai-service** — FastAPI via uvicorn on `:8000`
- **Ollama 0.33.2** — native systemd service on `:11434`

### Live database contents

| Table | Rows |
|---|---:|
| Organization | 1 |
| User | 2 |
| LocationType | 3 |
| LocationNode | 111 (3 store rooms · 18 racks · 90 shelves) |
| ProductCategory | 9 |
| UnitOfMeasure | 7 |
| Supplier | 7 |
| Product | 75 |
| StockPosition | 83 |
| StockMovement | 13,067 |
| Recommendation | 8 |
| PurchaseOrder | 0 |
| CycleCount | 5 (4 closed, 1 open) |
| CycleCountLine | 22 |
| AuditLog | 104 |

> **Note on the StockMovement count.** The last seed run inserted 8,168 rows (8,160 generated
> history + 8 cycle-count adjustments). The remaining **4,899 rows are orphaned** — left behind by
> earlier seed generations, pointing at product IDs that no longer exist. `StockMovement` is
> append-only by DESC control #10, so they cannot be deleted; the seed never tries. This is a known,
> documented condition — see [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) #14. The only way to a
> perfectly clean database is a deliberate full drop and recreate.

---

## 3. The core business loop

1. Every **product** and every **stock-holding location** carries a barcode.
2. A **Store Keeper** scans a location, then scans products, and records a **movement** —
   goods in, goods out, transfer, cycle count, or adjustment.
3. Stock quantity and exact physical location update in real time; an **immutable audit record** is
   written **in the same database transaction**.
4. Each day at a configured time (default 07:00 Gulf Standard Time), the **AI Store Manager**
   reviews stock, consumption rates, and supplier lead times and determines what needs reordering.
5. It produces a recommendation **with the reasoning behind it, in both languages**.
6. The **Administrator** approves, amends the quantity, or rejects.
7. On approval, the system generates a **PDF purchase order** grouped by supplier and emails it.
8. Goods arrive, are scanned in, and the cycle closes.

---

## 4. Hardware and runtime environment

### The production device (in hand, in use)

| | |
|---|---|
| Board | **NVIDIA Jetson Orin Nano**, 8 GB unified memory (7.4 GiB visible) |
| Architecture | `aarch64` |
| OS | Ubuntu 22.04, kernel `5.15.148-tegra` |
| JetPack | R36 revision 4.7 |

The 8 GB unified-memory constraint is **the single most consequential hardware fact in this
project** — it drove the language-model choice (§15) and ruled out the model the specification
originally named.

### Runtimes (verified versions)

| Runtime | Version |
|---|---|
| Node.js | v20.20.2 |
| Python | 3.10.12 |
| PostgreSQL | 16.15 |
| Ollama | 0.33.2 |

### Ollama models present on the box

`qwen2.5:1.5b` (986 MB — **the production profile**), `qwen2.5:3b`, `qwen2.5:3b-instruct-q3_K_M`,
`qwen2.5:3b-instruct-q2_K`, `qwen2.5:7b`, `qwen2.5:7b-instruct-q3_K_S`. The larger ones remain on
disk from the capacity testing documented in §15; only 1.5b is actually loaded at runtime.

### Development vs production

The architecture **never changes** between environments. Only configuration does.

| | Development (now) | Production (later) |
|---|---|---|
| Compose file | `docker-compose.development.yml` | `docker-compose.production.yml` |
| Language model | `llama-development` profile | `qwen-production` profile |
| Model runtime | Ollama on CPU | Ollama on GPU |
| TLS | self-signed / none locally | real certificate at nginx |
| Object storage | MinIO container | MinIO, encrypted volume |
| Secrets | `.env` files, git-ignored | injected at deploy |

> **Current reality:** everything runs **natively** on the Jetson (npm + uvicorn + systemd Ollama),
> not in Docker. Production Docker/nginx/TLS/backup packaging is the main deferred work item.

---

## 5. Technology stack

### Frontend

| Concern | Choice | Version |
|---|---|---|
| Framework | React + TypeScript (strict) | ^18.3.1 |
| Build | Vite | ^5.4.2 |
| Routing | React Router | ^6.26.1 |
| Server state | TanStack Query | ^5.51.23 |
| Client state | Zustand (theme, language, auth, offline queue only) | ^4.5.5 |
| Styling | Tailwind CSS, default palette disabled, mapped to tokens | ^3.4.10 |
| Translation | react-i18next / i18next | ^14.1.3 / ^23.12.2 |
| Charts | Recharts | ^2.15.4 |
| Icons | Lucide React (1.5px stroke, 18px default) | ^0.427.0 |
| Offline storage | Dexie (IndexedDB) | ^4.4.4 |

### Backend

| Concern | Choice | Version |
|---|---|---|
| Framework | NestJS (TypeScript, strict) | ^10.4.4 |
| ORM | Prisma | ^5.22.0 |
| Database | PostgreSQL | 16.15 |
| Auth | Passport JWT (access + refresh) | ^4.0.1 |
| Password hashing | `@node-rs/argon2` (argon2id) | ^2.0.2 |
| Validation | Zod | ^3.25.76 |
| Barcodes | bwip-js (Code128) | ^4.11.2 |
| PDF | PDFKit | ^0.15.2 |
| Excel | ExcelJS | ^4.4.0 |
| Email | Nodemailer | ^6.10.1 |
| Secure headers | Helmet | ^7.1.0 |
| API docs | `@nestjs/swagger` → OpenAPI | ^7.4.2 |
| Tests | Jest + ts-jest | ^30.5.2 / ^29.4.12 |

### AI service

| Concern | Choice | Version |
|---|---|---|
| Framework | FastAPI | 0.115.0 |
| Server | uvicorn | 0.30.6 |
| Models/validation | Pydantic + pydantic-settings | 2.9.2 / 2.5.2 |
| Scheduling | APScheduler | 3.10.4 |
| HTTP client | httpx | 0.27.2 |
| Forecasting | statsmodels | 0.14.2 |
| Model runtime | Ollama (local, no external calls) | 0.33.2 |
| Tests | pytest + pytest-asyncio | 8.3.3 / 0.24.0 |

> **Deliberately NOT installed:** `sentence-transformers` and `faiss-cpu`, both named in the spec.
> At a 50–75 product catalogue they are unjustified overhead, and a second resident ML model
> (~400–500 MB) would reintroduce the exact memory pressure the model choice was made to avoid.
> Product-name matching uses stdlib `difflib` instead. Both stay commented out in
> `requirements.txt`. See [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) #9.

---

## 6. Architecture and data flow

```
                    Browser — React SPA (:5173)
                              │
                    /api/v1/* │  (Vite dev server proxies /api → :3000)
                              ▼
        ┌──────────────── NestJS backend (:3000) ─────────────────┐
        │                                                          │
        │   Prisma ──────────────────────► PostgreSQL (:5432)      │
        │                                   mizan_inventory        │
        │                                                          │
        │   Nodemailer ──────────────────► SMTP relay              │
        │                                   (only permitted        │
        │                                    outbound traffic)     │
        │                                                          │
        │   ai-service-client (fetch) ───► ai-service (:8000)      │
        └──────────────────────────────────────┬───────────────────┘
                                               │
                              ┌────────────────┴─────────────────┐
                              │  FastAPI ai-service              │
                              │   · assistant (§8.4)             │
                              │   · demand forecasting (§8.2)    │
                              │   · APScheduler daily trigger    │
                              │            │                     │
                              │            ▼                     │
                              │      Ollama (:11434)             │
                              │      qwen2.5:1.5b                │
                              └──────────────────────────────────┘
```

**Critical architectural facts:**

- **The deterministic reorder engine lives in the backend, not the AI service.** It is transparent
  template maths (§15), needs no GPU, and is verifiable today. The Python service owns the
  *scheduled trigger* plus the genuinely LLM-dependent work. This is a documented deviation from
  spec §3.3 — see [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) #7.
- **The ai-service is never reachable from outside.** It binds `127.0.0.1:8000`; only the backend
  calls it. It is not proxied through nginx and not exposed on the LAN (DESC control #11).
- **The AI service calls back into the backend** for data, authenticating with a service account.
  It never touches the database directly — so every figure it sees has already passed through the
  same API, guards, and validation as a user request.
- **There are no foreign-key constraints in the schema.** All references are plain string IDs. This
  is why deletion is guarded in application code (§11, safe delete) and why joins are done by
  in-memory maps rather than nested Prisma queries.

---

## 7. Repository structure

```
mizan-inventory-system/
│
├── CLAUDE.md                          ← the binding build specification
├── PROGRESS.md                        ← dated session-by-session build log
├── OPEN-QUESTIONS.md                  ← unresolved decisions (16 entries, 2 resolved)
├── THINGS-TO-DO.md                    ← plain-language checklist
├── PROJECT-STUDY-GUIDE.md             ← this file
├── README.md · HOW-TO-RUN.md
│
├── docker-compose.development.yml     ← dev stack (only nginx published)
├── .env.development                   ← shared dev env (git-ignored)
│
├── backend/                           NestJS API
│   ├── .env                           ← active DB + secrets (git-ignored)
│   ├── jest.config.js                 ← unit-test config
│   ├── prisma/
│   │   ├── schema.prisma              ← the data model (15 models, 5 enums)
│   │   ├── migrations/                ← 3 migrations (see §8)
│   │   ├── seed.ts                    ← the demo dataset (§19)
│   │   └── entity-seed.ts             ← parameterised provisioner for new entities
│   └── src/
│       ├── main.ts                    ← bootstrap: helmet, CORS, /api/v1, swagger
│       ├── app.module.ts              ← 22 feature modules registered
│       ├── database/                  PrismaService (@Global PrismaModule)
│       ├── security/                  ZodValidationPipe
│       ├── email/                     Nodemailer service
│       ├── ai-service-client/         typed fetch client → ai-service
│       └── modules/                   one folder per capability (§11)
│
├── frontend/                          React SPA
│   ├── vite.config.ts                 ← /api proxy → :3000, @shared alias
│   └── src/
│       ├── App.tsx                    ← all routes
│       ├── main.tsx
│       ├── application-shell/         NavigationRail · TopBar · StatusStrip · preferences
│       ├── features/                  one folder per screen (§12)
│       ├── design-system/             Modal · ConfirmDialog · Drawer ·
│       │                              LocationDesignator · LocationChip ·
│       │                              StockStatusIndicator
│       ├── api-client/client.ts       ← every typed API call + React Query hook
│       ├── internationalisation/      i18n setup
│       └── offline-queue/             Dexie outbox store
│
├── ai-service/                        Python FastAPI
│   ├── requirements.txt · pytest.ini · .env.development
│   ├── src/
│   │   ├── main.py                    ← app + APScheduler lifespan
│   │   ├── assistant/                 query_router · inventory_data_retriever ·
│   │   │                              response_composer · tool_definitions · api
│   │   ├── demand_forecasting/        consumption_history · forecast_models ·
│   │   │                              seasonal_analyser · api
│   │   ├── language_model/            provider abstraction · ollama_provider ·
│   │   │                              model_profiles
│   │   ├── replenishment/             daily_review_job (the scheduled trigger)
│   │   └── shared/                    configuration
│   └── tests/                         3 pytest files, 44 tests
│
├── shared/                            consumed by both apps
│   ├── design-tokens/design-tokens.css   ← 145 lines, ~46 tokens, light + dark
│   └── translations/{english,arabic}.json ← 23 namespaces, 358 keys each
│
├── database/
│   ├── migrations/0001_append_only_rules.sql   ← DESC #10, applied to every DB
│   └── LOCAL-DATABASE-SETUP.md
│
├── documentation/
│   ├── security-compliance/
│   │   ├── control-implementation-matrix.md
│   │   ├── evidence-control-10-append-only-rules.sql
│   │   └── language-model-validation.md        ← §2.2 gate: DOES NOT PASS
│   └── gpu-readiness-and-upgrades.md
│
├── infrastructure/                    nginx · docker · environment-templates
├── hosting/                           opt-in cloud demo (firebase.json + guide)
├── brand/                             Mizan logo + marks (SVG)
└── scripts/create-entity.ps1          ← one-command new-entity provisioner
```

---

## 8. Data model — every table, every field

Defined in `backend/prisma/schema.prisma`. **15 models, 5 enums, no foreign-key constraints.**

### Migrations

| Migration | What it added |
|---|---|
| `20260730110858_init` | The initial schema |
| `20260801055236_cycle_counts` | `CycleCount` + `CycleCountLine` + `CycleCountStatus` |
| `20260923062617_add_product_unit_cost_and_org_currency` | `Product.unitCost`, `Organization.currency` |
| `database/migrations/0001_append_only_rules.sql` | **Raw SQL, applied separately to every database** — PostgreSQL rules making `UPDATE`/`DELETE` on `AuditLog` and `StockMovement` no-ops (DESC #10) |

### Enums

```
Role                  ADMIN · STORE_KEEPER
MovementType          GOODS_IN · GOODS_OUT · TRANSFER · CYCLE_COUNT · ADJUSTMENT
BarcodeSource         MANUFACTURER · INTERNAL
RecommendationStatus  PENDING · APPROVED · AMENDED · REJECTED · ORDERED · RECEIVED
CycleCountStatus      OPEN · CLOSED
```

### `User`
| Field | Type | Notes |
|---|---|---|
| `id` | String @id @default(cuid()) | |
| `email` | String @unique | |
| `passwordHash` | String | argon2id |
| `displayName` | String | |
| `role` | Role | |
| `preferredLanguage` | String @default("en") | |
| `preferredTheme` | String @default("system") | |
| `isActive` | Boolean @default(true) | |
| `mfaSecret` | String? | TOTP built, disabled by default |
| `failedLoginCount` | Int @default(0) | DESC #5 lockout |
| `lockedUntil` | DateTime? | DESC #5 lockout |
| `lastLoginAt` | DateTime? | |
| `createdAt` | DateTime @default(now()) | |

### `Organization`
One row per deployment — the tenant identity, present from day one so multi-customer support later
needs no migration.

| Field | Type | Notes |
|---|---|---|
| `id` `code` @unique `nameEn` `nameAr` | String | `code` e.g. "DEMO" |
| `timezone` | String @default("Asia/Dubai") | |
| `defaultLanguage` | String @default("en") | |
| `currency` | String @default("AED") | ISO 4217; drives all cost/spend displays |
| `logoObjectKey` | String? | white-label logo (upload deferred until MinIO) |
| `isActive` `createdAt` | | |

### `LocationType`
**The shape of storage is data, not code.** One row per level of the customer's hierarchy.

| Field | Type | Notes |
|---|---|---|
| `id` `organizationId` | String | |
| `code` | String | `SITE` `WAREHOUSE` `STORE_ROOM` `ZONE` `AISLE` `RACK` `LEVEL` `BIN` … |
| `nameEn` `nameAr` | String | the **vocabulary shown in the UI** |
| `depth` | Int | 0 = top of tree |
| `canHoldStock` | Boolean @default(false) | true only for the level that stores goods |
| `codePattern` | String? | optional regex validation, e.g. `^SR\d+$` |
| `sortOrder` `isActive` | | |
| | | `@@unique([organizationId, code])` |

### `LocationNode`
A single self-referencing tree of **arbitrary depth** replacing fixed room/rack/level tables.

| Field | Type | Notes |
|---|---|---|
| `id` `organizationId` | String | |
| `parentId` | String? | null = root |
| `locationTypeId` | String | |
| `code` | String | `"SR1"`, `"R1"`, `"L1"` |
| `nameEn` `nameAr` | String? | |
| `materialisedPath` | String | `/rootId/childId/leafId` — subtree queries are one indexed `LIKE` |
| `designator` | String | **cached** ancestor codes joined by `-`: `SR1-R1-L1` |
| `depth` | Int | |
| `barcode` | String? @unique | present only when the type `canHoldStock` |
| `isActive` `sortOrder` `createdAt` | | |
| | | `@@unique([parentId, code])` — codes unique among **siblings**, not globally |
| | | `@@index([organizationId, designator])`, `@@index([materialisedPath])` |

### `ProductCategory`
Nesting tree, same pattern as locations. `id` `organizationId` `parentId?` `code` `nameEn` `nameAr`
`materialisedPath` `sortOrder` `isActive`, `@@unique([organizationId, code])`.

### `UnitOfMeasure`
`id` `organizationId` `code` `nameEn` `nameAr` `isBaseUnit`, `@@unique([organizationId, code])`.
Seeded: UNIT, BOX, CARTON, PACK, ROLL, BOTTLE, KG.

### `ProductAttributeDefinition`
Per-deployment custom product fields. `key` `labelEn` `labelAr` `dataType`
(TEXT/NUMBER/BOOLEAN/DATE/SELECT) `selectOptions?` `isRequired` `sortOrder`.

### `Product`
| Field | Type | Notes |
|---|---|---|
| `id` `organizationId` `sku` | String | `@@unique([organizationId, sku])` |
| `barcode` | String @unique | |
| `barcodeSource` | BarcodeSource | INTERNAL barcodes generated as `INT-#########` |
| `nameEn` `nameAr` | String | |
| `categoryId` | String? | |
| `baseUnitId` | String | → UnitOfMeasure |
| `packSize` | Int @default(1) | display-only conversion; base units stored internally |
| `reorderPoint` `minLevel` `maxLevel` | Int | drive stock status and the reorder engine |
| `unitCost` | Decimal? @db.Decimal(10,2) | **cost per base unit**, in `Organization.currency`; null = not set |
| `supplierId` | String? | |
| `customAttributes` | Json? | validated against `ProductAttributeDefinition` |
| `isActive` | Boolean @default(true) | |

### `StockPosition`
`id` `productId` `locationNodeId` `quantity` `updatedAt`,
`@@unique([productId, locationNodeId])`. The location must be a node whose type `canHoldStock`.

### `StockMovement` — **APPEND-ONLY**
| Field | Type | Notes |
|---|---|---|
| `id` | String @id | |
| `clientId` | String @unique | **idempotency key from the device** — safe offline retry |
| `type` | MovementType | |
| `productId` | String | |
| `fromLocationNodeId` `toLocationNodeId` | String? | which are set depends on type |
| `quantity` | Int | **positive magnitude** for GOODS_IN/GOODS_OUT/TRANSFER; **signed delta** for ADJUSTMENT |
| `reason` | String? | mandatory ≥10 chars for ADJUSTMENT, enforced in the service |
| `userId` | String | |
| `createdAt` | DateTime @default(now()) | |
| | | `@@index([productId, createdAt])`, `@@index([createdAt])` |

> **The `quantity` sign convention is a real trap.** Because non-adjustment rows store a positive
> magnitude, a naive `quantity > 0 ? '+' : ''` renders a goods-out as an increase. Both display
> sites use a `signedQty(type, quantity)` helper instead — `MovementHistoryPanel.tsx` and
> `DashboardPage.tsx`. This was a genuine bug fixed on 2026-09-23.

### `Supplier`
`id` `name` `email` `phone?` `leadTimeDays` `isActive`. `leadTimeDays` feeds the reorder engine.

### `Recommendation`
`id` `productId` `suggestedQty` `approvedQty?` `reasonCode`
(`BELOW_REORDER_POINT` | `FORECAST_DEPLETION` | `SEASONAL_UPLIFT`) `reasoningEn` `reasoningAr`
`status` `generatedAt` `decidedByUserId?` `decidedAt?` `purchaseOrderId?`.

### `PurchaseOrder`
`id` `poNumber` @unique (`PO-YYYY-####`) `supplierId` `status` (DRAFT/SENT/RECEIVED) `pdfKey?`
`sentAt?` `createdAt`.

### `AuditLog` — **APPEND-ONLY**
`id` `actorId?` `action` `entityType` `entityId` `before` Json? `after` Json? `ipAddress?`
`createdAt`. Indexed on `createdAt` and `[entityType, entityId]`.

### `CycleCount` / `CycleCountLine`
Stock-take sessions. `CycleCount`: `id` `organizationId` `status` `note?` `createdByUserId`
`createdAt` `closedAt?`. `CycleCountLine`: `cycleCountId` `productId` `locationNodeId` `countedQty`
`systemQty` `createdAt`, `@@unique([cycleCountId, productId, locationNodeId])`.

**Counting never mutates stock.** Closing a session with "apply" creates one audited `ADJUSTMENT`
movement per non-zero variance, through the same verified movements path.

---

## 9. The configurable hierarchy — the product differentiator

This is the single most important design idea and the strongest commercial argument.

> **Any customer must be able to model their own storage — one store room, ten store rooms, or
> several warehouses with aisles and bins — through the administration interface, without a
> developer, a migration, or a code change.**

`LocationType` defines the *shape*. `LocationNode` holds the actual places.

| Customer type | Configured location types | Resulting designator |
|---|---|---|
| Store-room customer | `STORE_ROOM > RACK > LEVEL` | `SR1-R1-L1` |
| Hospital | `BUILDING > FLOOR > ROOM > CABINET > SHELF` | `B2-F3-R12-C4-S2` |
| Distribution centre | `SITE > WAREHOUSE > AISLE > RACK > LEVEL > BIN` | `JEB-WH2-A7-R3-L2-B4` |
| Generic default | `WAREHOUSE > AISLE > SHELF` | `W1-A1-S1` |

**The rules:**

- Depth is arbitrary. Nothing assumes three levels.
- `canHoldStock` marks which type actually stores goods. Only those nodes get a barcode and can
  hold a `StockPosition`. Everything above is structure.
- `designator` is the ancestor `code` values joined by `-`, computed on write and cached; the whole
  subtree is recomputed when a node is renamed or moved.
- `materialisedPath` makes subtree queries a single indexed `LIKE '/parentId/%'` — the application
  never recurses.
- Codes are unique **among siblings**, not globally. Two store rooms may each have an `R1`.
- **Deactivate, never delete.** A location that has ever held stock is referenced by movement
  history and must survive for audit.

**Vocabulary is configurable too.** Nothing hardcodes "store room", "rack", or "level". Every label
comes from the `LocationType` record's `nameEn`/`nameAr`; translation files carry generic strings
with interpolation: `"locations.addChild": "Add {{typeName}}"` → "Add Rack" / "Add Aisle".

The signature UI element — the **location designator strip** — takes an *array of segments*, never
three fixed values, and degrades gracefully at 5, 6, and more segments (§13).

> **The guardrail:** if you find yourself writing `if (type === 'STORE_ROOM')` anywhere, stop. That
> is a configuration value, not a branch. Grepping for `STORE_ROOM`, `RACK`, `LEVEL`, or a literal
> depth of three should find no matches outside seed data and tests.

---

## 10. Complete API surface

REST at `/api/v1`, OpenAPI-documented at `/api/v1/docs`, JWT bearer auth, Zod-validated at every
boundary. **Every route below was read from the controllers.**

### Authentication — `/auth`
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | → access + refresh tokens; lockout after 5 failures |
| POST | `/auth/refresh` | public | rotates the token pair |
| POST | `/auth/logout` | auth | |
| GET | `/auth/me` | auth | current user |

### Health & system
| Method | Path | Role |
|---|---|---|
| GET | `/health` | public |
| GET | `/system/info` | public — app/org name, versions, demo logins (dev only) |

### Organization — `/organization`
| Method | Path | Role |
|---|---|---|
| GET | `/organization` | auth |
| PATCH | `/organization` | **ADMIN** — name EN/AR, default language, timezone (audited) |

### Products — `/products`
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/products` | auth | `?search` `?categoryId` `?lowStock` |
| POST | `/products` | **ADMIN** | generates an internal barcode if none given |
| PATCH | `/products/:id` | **ADMIN** | |
| DELETE | `/products/:id` | **ADMIN** | guarded — 409 if any history exists |
| GET | `/products/:id` | auth | detail + stock positions |
| GET | `/products/:id/stock` | auth | positions across locations |
| GET | `/products/resolve/:barcode` | auth | scan resolution |
| GET | `/products/import-template` | auth | downloadable Excel template |
| POST | `/products/import` | **ADMIN** | multipart; `?dryRun=true` validates only |

### Reference data
| Method | Path | Role |
|---|---|---|
| GET | `/product-categories` | auth — tree |
| GET | `/units-of-measure` | auth |
| GET | `/location-types` | auth |

### Storage locations — `/storage-locations`
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/storage-locations` | auth | tree with item/unit rollups |
| GET | `/storage-locations/:id` | auth | |
| GET | `/storage-locations/:id/stock` | auth | |
| GET | `/storage-locations/resolve/:barcode` | auth | |
| POST | `/storage-locations` | **ADMIN** | create one node |
| POST | `/storage-locations/bulk-create` | **ADMIN** | the generator; `?preview=true` |
| PATCH | `/storage-locations/:id` | **ADMIN** | rename / deactivate |
| DELETE | `/storage-locations/:id` | **ADMIN** | subtree cascade, guarded |

### Stock movements — `/stock-movements`
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/stock-movements` | auth | **idempotent on `clientId`**, atomic, audited |
| GET | `/stock-movements` | auth | `?type` `?productId` `?locationId` `?userId` `?from` `?to` `?limit` (default 100, max 5000) |

### Cycle counting — `/cycle-counts`
| Method | Path | Role |
|---|---|---|
| GET | `/cycle-counts` | auth — session list |
| POST | `/cycle-counts` | auth — start a session |
| GET | `/cycle-counts/:id` | auth — live variance report |
| POST | `/cycle-counts/:id/scan` | auth — record a counted quantity |
| POST | `/cycle-counts/:id/close` | auth — `{ apply }`; applies variances as ADJUSTMENTs |

### Replenishment — `/recommendations`
| Method | Path | Role |
|---|---|---|
| GET | `/recommendations` | auth — `?status` |
| POST | `/recommendations/run` | **ADMIN** — trigger the review now |
| POST | `/recommendations/:id/approve` | **ADMIN** — `{ approvedQty? }` |
| POST | `/recommendations/:id/reject` | **ADMIN** — `{ reason }` |

### Purchase orders — `/purchase-orders`
| Method | Path | Role |
|---|---|---|
| GET | `/purchase-orders` | auth |
| POST | `/purchase-orders/generate` | **ADMIN** — groups approved recs by supplier, PDFs, emails |
| GET | `/purchase-orders/:id/pdf` | auth |

### Suppliers — `/suppliers`
`GET` (auth) · `POST` / `PATCH :id` / `DELETE :id` (**ADMIN**, delete guarded).

### Predictive analytics — `/predictive-analytics` *(added 2026-09-23)*
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/predictive-analytics/summary` | auth (both roles) | KPIs, days-until-stockout list, projected spend by supplier and category |
| GET | `/predictive-analytics/forecast/:productId` | auth | proxies the real ai-service forecaster |

### Barcode labels — `/barcode-labels`
`GET /product/:id` · `GET /location/:id` (`?includeDescendants`) · `POST /batch`. Code128 PNGs.

### Reports — `/reports`
`GET /stock-on-hand` · `GET /stock-movements` · `GET /replenishment`, each `?format=pdf|xlsx`.
**Exports are English-only for MVP.**

### Audit log & users
| Method | Path | Role |
|---|---|---|
| GET | `/audit-log` | **ADMIN** — `?entityType` `?action` `?from` |
| GET · POST · PATCH `:id` · DELETE `:id` | `/users` | **ADMIN** (whole controller) |

### Assistant — `/assistant`
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/assistant/query` | auth | `{ text, language }` → `{ answer, sources, isDevelopmentModel }`; every query writes an `ASSISTANT_QUERY` audit row |

### Internal — ai-service only (never exposed through nginx)
| Method | Path |
|---|---|
| GET | `/health` |
| POST | `/assistant/query` |
| GET | `/forecasting/products/{product_id}` |

---

## 11. Backend modules, one by one

Each lives in `backend/src/modules/<name>/` with `*.controller.ts`, `*.service.ts`, `*.schema.ts`,
and `*.spec.ts` as applicable. **22 modules registered in `app.module.ts`.**

### `authentication`
JWT access (15 min) + refresh (7 days), argon2id hashing, **account lockout** (5 failed attempts →
15-minute lock, written to the audit log), no account enumeration, localised error envelope.
`JwtAuthGuard` + `RolesGuard` + `@Roles()` decorator; roles are enforced **at the controller** and
never trusted from the client.

### `users`
Whole controller is ADMIN-only. Create/edit users, **password policy** (≥12 chars + common-password
blocklist enforced in `user.schema.ts`), role and active-state management, password reset.
Self-deactivation guard and last-admin guard.

### `products`
List with search/category/low-stock filters; detail with stock positions; create/update/delete;
internal barcode generation (`INT-#########`, retried on collision); **Excel import** with a
downloadable template, a dry-run validation pass, a row-by-row error report, and an all-or-nothing
commit — never a partial import. Exposes `computeStatus(qty, minLevel, reorderPoint)`, the single
definition of stock status reused across the codebase.

### `storage-locations`
Tree read with item/unit rollups from stock-holding descendants; single-node create; **bulk-create
generator** with preview; rename/deactivate; subtree move with designator recomputation; barcode
resolve; guarded subtree delete.

### `stock-movements`
The heart of the system. `create()` is **idempotent on `clientId`** (checked both before and inside
the transaction to close the retry race), atomic, and writes its `AuditLog` row **in the same
`$transaction`**. Enforces the negative-stock guard, the ≥10-character adjustment reason, and
per-type shape validation (goods-in needs a destination, transfer needs both and they must differ,
etc.). `list()` supports the full filter set used by the history screen.

### `cycle-counting`
Sessions; `scan()` snapshots the on-record quantity without mutating it; `close(apply)` walks the
variance report and creates one `ADJUSTMENT` per non-zero variance **through the verified movements
path**, so the never-negative rule and audit trail apply automatically.

### `replenishment`
`reorder-calculator.ts` — pure, deterministic (§15). `reasoning-generator.ts` — bilingual templates
filled with computed values, never an LLM. `replenishment.service.ts` runs the review, skips
products with an in-flight recommendation, honours the "not re-recommended the same day after
rejection" rule, and accepts optional Stage-2 forecast overrides without changing the interface.

### `purchase-orders`
Groups approved recommendations by supplier (one PO per supplier per run), allocates
`PO-YYYY-####`, renders a PDF with PDFKit, and emails it via Nodemailer. Inert and logged when SMTP
is unconfigured.

### `predictive-analytics` *(new)*
`predictive-analytics-calculator.ts` — four pure functions (`daysUntilStockout`,
`classifyUsageTrend`, `estimatedReorderCost`, `round2`) with a full Jest spec.
`predictive-analytics.service.ts` computes the summary by **reusing existing logic** — it imports
`calculateReorder` from the replenishment module and `computeStatus` from products rather than
re-deriving either — and proxies forecast requests to the ai-service.

### `dashboard`
`GET /dashboard/summary` returns real aggregates: stock status counts, 14-day goods-in/goods-out
trend (zero-filled), stock-by-category rollup (top 6 + "Other"), recommendation pipeline by status,
30-day movement count, and the 8 most recent movements with resolved names.

### `reports` · `barcode-labels` · `audit-log` · `suppliers` · `organization` · `reference-data` · `system` · `health` · `assistant`
Straightforward capability modules — see §10 for their routes.

### Cross-cutting
- `database/prisma.service.ts` + `@Global PrismaModule`
- `security/zod-validation.pipe.ts` — the single validation boundary
- `email/email.service.ts` — Nodemailer
- `ai-service-client/` — typed `fetch` client with localised `ServiceUnavailableException`s and
  timeouts (60 s assistant, 30 s forecast)

---

## 12. Frontend screens, one by one

Routes are declared in `frontend/src/App.tsx`; the navigation rail lists 12 destinations.

| Route | Screen | Notes |
|---|---|---|
| `/login` | `LoginPage` | Real auth; shows the org name live |
| `/dashboard` | `DashboardPage` | 5 KPI tiles, movement-trend line chart, stock-by-category bar chart, stock-health and replenishment-pipeline segmented bars, "needs your attention" card, recent-activity table |
| `/products` | `ProductsPage` | Table with search, category filter, low-stock toggle, **unit cost column**, barcode resolve, batch label printing, import |
| `/products/:id` | `ProductDetailPage` | Full field grid incl. **unit cost**, "where it's stored" positions, print/edit/delete |
| `/locations` | `LocationsPage` | Real tree, expand/collapse, item/unit rollups, bulk-create, delete |
| `/stock` | `StockMovementsPage` | **Two modes:** *Record* (scan-to-record + offline outbox) and *History* (§ below) |
| `/cycle-counting` | `CycleCountPage` | Session list + live variance table |
| `/replenishment` | `ReplenishmentPage` | Recommendation cards with bilingual reasoning, approve / amend / reject, PO generation |
| `/insights` | `InsightsPage` | **Predictive Analytics** (§ below) |
| `/suppliers` | `SuppliersPage` | List + create/edit/delete |
| `/reports` | `ReportsPage` | PDF/Excel exports |
| `/audit-log` | `AuditLogPage` | ADMIN viewer with filters and before/after JSON |
| `/users` | `UsersPage` | ADMIN user management |
| `/settings` | `OrganizationSettingsPage` | White-label: org name EN/AR, language, timezone |

### Application shell
- **Navigation rail** — fixed 220 px, always visible (never a hamburger), with the Mizan mark, the
  live organisation name, and a development-only "Demo logins" reveal.
- **Top bar** — page title, theme toggle, language toggle, user identity, logout.
- **Status strip** — persistent 32 px bottom bar: sync state, **offline queue depth**, API version,
  DB connection, org code, live clock. Never hidden — it is how the Store Keeper trusts that scans
  are saving.

### `/stock` — Record mode
Segmented movement-type switcher (Goods In / Goods Out / Transfer / Adjustment) → location slots
(barcode input, location-first flow) → product scan → quantity, with live "currently here" and a
signed-delta preview for adjustments. Every movement goes to the **Dexie/IndexedDB outbox first**,
then syncs; retries on startup, on reconnect, and every 20 s. Nothing is ever silently dropped.

### `/stock` — History mode *(added 2026-09-23)*
`MovementHistoryPanel.tsx`. Reads the real `GET /stock-movements`, not the local outbox. Filters:
type, product, date range, and — **ADMIN only** — user. Sticky-header table with time, type,
product+SKU, signed quantity, from→to location chips, reason, and actor. "Load more" grows the
request limit in pages of 100.

> **Why this screen exists.** The Record-mode "this session" list reads the *local outbox*, so a
> fresh browser showed nothing regardless of how much history the database held — which read as
> "there are only a few days of transactions". Diagnosing that (rather than taking the symptom at
> face value) is what produced this screen. See [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) #16.

### `/insights` — Predictive Analytics *(added 2026-09-23)*
Four panels, all read-only, every figure traceable to a database row:

1. **Summary strip** — 4 KPI tiles: products running out within 7 days, projected reorder spend,
   products trending up in usage, products needing reorder now.
2. **Days until stockout** — ranked table of most-at-risk products with status dot, a proportional
   bar, daily usage, and a hand-drawn 14-day SVG sparkline per row.
3. **Forecast vs actual** — line chart per selected product: recorded `GOODS_OUT` history against
   the real ai-service forecast, dashed and bridged at the seam. **Below the model's history
   minimum it shows "building forecast — N of M days of history needed" instead of drawing a fake
   line.**
4. **Projected spend** — recommended quantity × unit cost, grouped by supplier and by category,
   with a total. The "investor money panel".

### Design-system components
`Modal` · `ConfirmDialog` (surfaces the backend's "deactivate instead" message inline) · `Drawer` ·
`LocationDesignator` (the signature strip) · `LocationChip` (the small table variant) ·
`StockStatusIndicator` (6 px square + text label, never colour alone).

### Assistant
`AssistantLauncher` (floating button) + `AssistantPanel` + `assistant.store`. Natural-language
questions; responses carry their source values and a development-model badge when applicable.

---

## 13. Design system

Defined once in `shared/design-tokens/design-tokens.css` — **145 lines, ~46 tokens**, light and
dark blocks plus a `prefers-color-scheme` fallback. Every colour, spacing value, radius, and font
size in the application comes from these tokens; components contain **no hardcoded values**.

### The thesis
The subject is an aviation authority's store room, whose most characteristic artifact is the
**position designator** — `SR1-R1-L1`. The interface takes its identity from the *typographic
discipline of aviation wayfinding*: segmented codes, monospaced figures, high contrast,
unambiguous at arm's length. **The interface is an instrument, not a brochure.** One bold element;
everything else disciplined.

### Prohibited (these make work look machine-generated)
Purple/indigo/violet primaries · gradients · glassmorphism · emoji as icons · pill-shaped buttons ·
drop shadows on resting elements · card grids where a table belongs · cream-and-terracotta ·
near-black with one acid accent · Inter/Roboto/system-ui as the primary typeface · the default
Tailwind palette · centred hero sections and marketing layouts.

### Typography
IBM Plex Sans (Latin) · IBM Plex Sans Arabic · IBM Plex Mono (data and designators), weights
400/500/600. Chosen because Plex is institutional rather than fashionable, and the Arabic face is
drawn by the same foundry — switching language keeps colour, weight, and rhythm consistent.
**All numerals use `font-variant-numeric: tabular-nums`.**

Scale: `--text-2xs` 11px · `--text-xs` 12px · `--text-sm` 13px (default for data) · `--text-base`
15px · `--text-lg` 18px · `--text-xl` 22px · `--text-2xl` 28px · `--text-designator` 34px.

### Colour — light theme
Institutional deep teal, distinct from the blue every admin template uses. Muted gold appears only
on the designator and genuine emphasis.

```
--canvas #F4F6F7   --surface #FFFFFF   --surface-sunken #EDF1F2
--hairline #D6DEE2 --hairline-strong #B9C6CC
--ink #0D1B22      --ink-muted #566A75  --ink-faint #8497A0
--primary #0B4F5E  --primary-hover #08404C --primary-soft #E1EDF0 --on-primary #FFFFFF
--gold #A67C1A     --gold-soft #F7EFDC
--ok #1E6B45  --warn #8A5A00  --critical #9B2226  --info #0B4F5E
```

### Colour — dark theme "Graphite"
Selected by the client over an earlier teal-slate variant. Neutral warm-grey panels with a
teal-cyan accent — an instrument panel at night, *not* black.

```
--canvas #141518   --surface #1C1E22   --surface-sunken #0F1013
--ink #E8E9EC      --ink-muted #9CA0A8 --ink-faint #6E727B
--primary #46A9BE  --primary-hover #59BCCF --primary-soft #12292F --on-primary #06171B
--gold #D9AC4B
--ok #52AC7E  --warn #D4A23E  --critical #E06A6E  --focus #6FC6D8
```

Every text/background pair must meet **WCAG 2.1 AA (4.5:1)** — a government accessibility
requirement and a piece of DESC evidence.

### Geometry
`--radius-sm` 8px · `--radius-md` 14px (default) · `--radius-lg` 20px. 8px grid: 4 8 12 16 24 32 48 64.

> **Revised client decision, 2026-09-23.** Corners were originally capped at 4px with large radii
> explicitly prohibited. The client asked for visibly curved corners; this conflicted with the
> written spec, so it was **flagged before changing anything** rather than silently overridden. The
> client chose "pronounced" (12–14px). Because nearly every component already referenced the
> tokens, the change cascaded automatically. §9.2's prohibition was narrowed from a blanket ban on
> large radii to specifically pill/capsule shapes (radius ≥ half the element's height), which
> remains in force. The printed barcode-label popup — a physical print artifact — was left alone.

**Separation uses hairline borders, not shadows.** Shadows appear only on genuinely floating layers
(modal, dropdown, toast) and stay tight: `0 2px 8px rgb(0 0 0 / 0.12)`.

### The signature element — the location designator strip
The one bold move. When a Store Keeper scans a location it renders full-width as a segmented code
styled after gate signage: large monospace segments, each in its own cell divided by hairlines, a
2px gold rule beneath the segment row, and the room name right-aligned in tracked uppercase.

**It takes an array of segments, never three fixed values.** Rendering rules: 2–4 segments show all
at full size; 5 segments drop to 28px; 6 or more show the first segment, an ellipsis cell, then the
final three — **the leaf is always visible**, because it is what the operator is standing in front
of. In RTL the segment order reverses but each segment's text stays LTR; codes are never translated.

On scan: a 120 ms fade. No slide, no bounce. `prefers-reduced-motion` respected.

### Components
**Tables are the primary interface, not card grids.** 40px rows (32px compact), uppercase tracked
sticky headers on `--surface-sunken`, horizontal hairlines only — no vertical rules, no zebra
striping. Numeric columns right-aligned with tabular figures. Buttons 32/36/44px at
`--radius-md`, weight 500. Stock status is a 6px square **plus a text label** — never colour alone.
Charts use token colours only, no gradient fills, hairline grids, monospace tabular axis figures.

### Motion
120–180 ms, `cubic-bezier(0.2, 0, 0.2, 1)`. Permitted: designator fade, row hover, focus ring,
toast, skeleton. Not permitted: page transitions, parallax, scroll reveals, animated counters,
bouncing.

---

## 14. Bilingual — English and Arabic

Both are MVP scope. English is primary; **Arabic is complete, not partial**.

- `react-i18next`, files in `shared/translations/`. **23 namespaces, 358 keys, identical in both
  files** (verified — no drift).
  Namespaces: `app` `assistant` `roles` `dashboard` `products` `barcode` `movements`
  `replenishment` `purchaseOrders` `suppliers` `users` `audit` `reports` `cycleCount` `common`
  `navigation` `settings` `auth` `locations` `stock` `status` `errors` `insights`.
- `<html lang dir>` is set on switch; the preference persists to the user profile and localStorage.
- **CSS logical properties throughout** — `margin-inline-start`, `padding-inline-end`,
  `border-inline-start`. Never `left`/`right` for layout. Tailwind `ms-*`/`me-*`/`ps-*`/`pe-*`.
- Directional icons mirror in RTL; logos, clocks, and media controls do not.
- **Charts mirror axis placement in RTL** — value axes reverse and bar corner radii flip. This was a
  real bug found and fixed during the 2026-09-22 dashboard verification, along with Arabic category
  labels clipping off the chart edge.
- **Never translated or mirrored:** location designators, SKUs, barcodes, PO numbers, and currency
  amounts. All wrapped `dir="ltr"`.
- **A bidi trap worth knowing:** a bare minus sign in an RTL context reorders — `-1` renders as
  `1-`. Fixed with `dir="ltr"` on the quantity cells in both the movement history and dashboard
  tables (2026-09-23).
- Numerals: Western Arabic (0–9) in both languages, consistent with barcode data.
- Dates: Gregorian, `DD/MM/YYYY`, Gulf Standard Time (UTC+4).
- Products carry `nameEn` and `nameAr`, falling back to the other language rather than showing blank.
- **PDF and Excel exports are English-only for MVP.**

---

## 15. The AI — three engines

Only one of the three needs a GPU. This separation is deliberate and is why the procurement
workflow is demonstrable anywhere.

### 1. The replenishment engine — deterministic, no GPU, runs in the backend

`backend/src/modules/replenishment/reorder-calculator.ts`:

```
dailyUsage     = sum(GOODS_OUT quantity, trailing 30 days) / 30
leadTimeDemand = dailyUsage × supplier.leadTimeDays
safetyStock    = dailyUsage × 3
effectiveROP   = max(product.reorderPoint, ceil(leadTimeDemand + safetyStock))

if currentStock <= effectiveROP:
    suggestedQty = max(product.maxLevel - currentStock,
                       dailyUsage × supplier.leadTimeDays × 1.5)
    round up to nearest packSize
    reasonCode = BELOW_REORDER_POINT
```

Transparent, reproducible, and defensible to an auditor. Stage 2 replaces `dailyUsage` with a
forecast and adds the `FORECAST_DEPLETION` and `SEASONAL_UPLIFT` reason codes — **the interface
does not change, only the input.**

**Reasoning text** (`reasoning-generator.ts`) is generated from **templates filled with computed
values — never by the language model**:

> "Stock is 12 units. Average use is 4 units per day and delivery takes 5 days, so stock will run
> out in about 3 days. Recommend ordering 48 units."

Deterministic, reproducible, cannot hallucinate, **identical on any model**. This is precisely why
the development model's Arabic weakness (below) does not affect procurement.

### 2. Demand forecasting — Stage 2, in the ai-service

`ai-service/src/demand_forecasting/`:

| Module | Purpose |
|---|---|
| `consumption_history.py` | Pulls trailing `GOODS_OUT` and builds a daily, zero-filled pandas series |
| `forecast_models.py` | `SimpleExpSmoothing` (statsmodels). **`MIN_HISTORY_DAYS_FOR_FORECAST = 30`** — returns `None` below that, never a guess |
| `seasonal_analyser.py` | **`MIN_HISTORY_DAYS_FOR_SEASONALITY = 90`**, `UPLIFT_THRESHOLD = 1.25` (recent week ≥25% above baseline) |
| `api.py` | `GET /forecasting/products/{id}` — 60 display history points + 14 forecast points; `hasForecast: false` below the minimum |

**The honesty rule:** below the real history minimum the API says so and returns an empty forecast
list; the UI shows "building forecast — N of M days of history needed" rather than drawing a line.

### 3. The conversational assistant — Stage 2, needs the GPU

`ai-service/src/assistant/`. Architecture: **classify intent → run a structured query against the
backend → the model phrases an answer from the real returned data.**

> **The model never generates figures.** It formats retrieved values. Every numeric answer traces
> to a database row, and the source values ship in the response payload so the UI can show them.

**Two-tier routing, and the order matters:**
1. **Keyword router first** (`query_router.py`) — precise, tested, instant, phrasing-independent.
2. **Ollama tool-calling second** (`tool_definitions.py`, 6 tools mirroring real backend queries)
   for anything the keyword router cannot express.

Putting tool-calling first caused a real regression — it picked a less-useful tool for a case the
keyword router already handled exactly. Tool-calling gets one retry, because the small model does
not reliably produce a tool call on the first attempt, especially in Arabic.

### The model choice — and why the spec's model was not used

The specification named `qwen2.5:14b-instruct-q4_K_M` for production. **It was never viable on an
8 GB board.** Tested directly under real concurrent load (backend + frontend + Postgres + Ollama
all running, not Ollama alone):

| Model | Result |
|---|---|
| 14B | Never fit in memory |
| 7B | Confirmed not to work on this board |
| `qwen2.5:3b` (default quant) | Correct answers, but only ~100–250 MB free; **crashed once with CUDA OOM** |
| `qwen2.5:3b-instruct-q2_K` | **Pure gibberish** |
| `qwen2.5:3b-instruct-q3_K_M` | **Hallucinated a wrong stock total in Arabic** (said 8 when the data said 12) — a direct violation of the "never invent numbers" rule |
| **`qwen2.5:1.5b`** | **Chosen.** 1.3–2.7 GB headroom, zero crashes across every test, never invented a number. Arabic is noticeably terser and less fluent than 3B. |

Quantizing further made things *worse, not better* — a useful and non-obvious finding.

A separate discovery: `qwen2.5:1.5b` also hit the CUDA allocator error once, on a cold load after
Ollama's idle-unload. So this is a **board/driver-level flake independent of model size**, not
something a smaller model eliminates. `OllamaProvider.complete()` now retries once automatically
rather than surfacing a degraded answer for a transient error.

### The Arabic quality gate — **DOES NOT PASS**

`documentation/security-compliance/language-model-validation.md` records the result honestly:

> **Result: does not pass — Arabic ships with the development-model badge.**

English assistant quality is solid. Arabic is weaker, and one class of failure was serious enough
to warrant a structural fix rather than a prompt tweak: in the general-chat fallback tier, Arabic
**fabricated product sub-category names** that do not exist in the catalogue, with no number in the
answer for the existing verification to catch. English handled the identical scenario correctly.

**The fix:** Arabic general-chat now **skips LLM generation entirely** in that tier and returns a
fixed safe message. Deterministic, not a prompt adjustment — because prompting alone did not
prevent it even after a retry. The real UX cost (genuine Arabic small talk gets the same message as
an unresolved query) was accepted deliberately over fabrication risk.

`arabic_verified` stays `False` in `model_profiles.py` — never assumed true just because a model
sits in the "production" slot.

---

## 16. Business rules and where they are enforced

| # | Rule | Enforced in |
|---|---|---|
| 1 | **Stock cannot go negative** — reject with a clear message | `stock-movements.service.ts`, inside the transaction |
| 2 | **Adjustments require a reason** — minimum 10 characters | `stock-movements.service.ts` `validateShape()` |
| 3 | **Transfers are atomic** — decrement and increment in one transaction | `stock-movements.service.ts` `$transaction` |
| 4 | **Cycle counts do not mutate stock directly** — they produce a variance report; applying creates explicit audited `ADJUSTMENT` movements | `cycle-counting.service.ts` `close()` |
| 5 | **Only ADMIN approves** recommendations and purchase orders | `@Roles(Role.ADMIN)` on the controllers |
| 6 | **A rejected recommendation is not regenerated the same day** for the same product | `replenishment.service.ts` `runReview()` |
| 7 | **Purchase orders group by supplier** — one per supplier per approval run | `purchase-orders.service.ts` |
| 8 | **Every state change writes an audit record in the same transaction** | every service's `$transaction` block |
| 9 | **Pack conversion is display-only** — base units are stored internally | schema + UI |

### Safe delete — "deactivate, never delete"
Because there are no foreign keys, deletion is guarded in application code. A record is
**hard-deleted only when nothing references it**; otherwise a localised `409` explains to
deactivate instead. Every delete writes a `*_DELETE` audit entry.

| Entity | Guard |
|---|---|
| **Users** | not self · not the last admin · no movements, decisions, counts, or audit-actor rows |
| **Products** | no stock position, movement, recommendation, or cycle-count line |
| **Locations** | **subtree cascade** — a store room deletes with its empty racks and levels in one action only when the whole subtree holds 0 units and no history. Any stock, even 1 unit → blocked ("transfer first"). Emptied but with history → "deactivate instead" |
| **Suppliers** | not referenced by any product or purchase order |

---

## 17. Security and DESC compliance

Mandatory across every layer — not a final checkbox. Every phase produces both the control and its
evidence. Full matrix: `documentation/security-compliance/control-implementation-matrix.md`.

**Legend:** ☐ not started · ◐ in progress · ☑ implemented (dev) · ✔ verified with evidence

| # | Control | Status | Where |
|---|---|:---:|---|
| 1 | Encryption in transit (TLS at nginx, HSTS, TLS 1.2 min) | ◐ | compose defines nginx 443; conf + cert pending |
| 2 | Encryption at rest (encrypted PG volume, MinIO SSE) | ◐ | volumes defined; a prod-env gap in dev |
| 3 | Password storage (argon2id, ≥12 chars, blocklist) | ✔ | `@node-rs/argon2`; policy in `user.schema.ts`; verified weak password → 400 |
| 4 | Session management (JWT 15m / refresh 7d, rotated, revocable) | ◐ | live; **server-side revocation needs a Redis denylist** |
| 5 | Account lockout (5 attempts → 15m, audited) | ☑ | `authentication.service.ts`; writes `ACCOUNT_LOCKED` |
| 6 | Idle timeout (30m → re-auth) | ◐ | env var set; **frontend enforcement pending** |
| 7 | Multi-factor (TOTP built, disabled) | ◐ | `mfaSecret` field present; `MFA_ENABLED=false` |
| 8 | Access control (role guards at controller) | ☑ | verified: store keeper → 403 on `/users` |
| 9 | Audit logging (every state change, same transaction) | ☑ | all services; extended to `ASSISTANT_QUERY` |
| 10 | Log immutability (PG rules block UPDATE/DELETE) | ☑ | **applied to the live DB**, 4 rules verified via `pg_rules` |
| 11 | Network segmentation | ◐ | ai-service binds `127.0.0.1:8000` only; Docker-network form pending |
| 12 | Rate limiting on `/auth/*` | ☐ | **pending** |
| 13 | Secure headers (Helmet, strict CSP) | ☑ | `main.ts`; CSP tightening pending |
| 14 | Secrets management (env only, git-ignored) | ☑ | `.env.example` committed; real `.env*` ignored |
| 15 | Log hygiene (no PII, user IDs only) | ☐ | **Pino config pending** |
| 16 | Dependency scanning in the pipeline | ☐ | **pending** |
| 17 | Backup & recovery (encrypted, tested restore) | ☐ | **pending** |
| 18 | Data residency (all on-premise) | ☑ | no cloud services; only outbound is SMTP |
| 19 | Least privilege (runtime DB role, no superuser) | ◐ | app connects as `mizan`, not `postgres`; CREATEDB still granted for the dev shadow DB |
| 20 | Input validation (Zod at every boundary) | ☑ | `ZodValidationPipe`; Prisma parameterised |

### Evidence files
- ✅ `control-implementation-matrix.md`
- ✅ `evidence-control-10-append-only-rules.sql`
- ✅ `language-model-validation.md` — **result: does not pass** (§15)
- ⬜ `data-flow-diagram.md` · `encryption-configuration.md` · `access-control-model.md` ·
  `audit-logging-specification.md` · `backup-and-recovery-procedure.md` ·
  `dependency-scan-reports/` · `accessibility-conformance-report.md`

### Development-environment caveats
Controls 1, 2, and 17 are implemented but **not production-grade** on this box (self-signed
certificate, unencrypted host volume, local backups). The code and configuration exist now; the
environment gap is recorded. **A control is never removed just because we are in development.**

---

## 18. Testing

| Layer | Tool | Current state |
|---|---|---|
| Backend unit | Jest + ts-jest | **1 suite, 12 tests, passing** — `predictive-analytics-calculator.spec.ts` |
| AI service | pytest | **3 files, 44 tests, passing** — query router, response composer, forecast models |
| Backend integration | Jest + Testcontainers | **Not built** |
| Frontend unit | Vitest + Testing Library | **Not built** |
| End-to-end | Playwright | **Not built** |
| Accessibility | axe-core | **Not built** (axe is not installed) |

**Spec targets** (§15 of CLAUDE.md), for reference against the current state: ≥80% on backend
services, all endpoints covered by integration tests, ≥90% on the reorder calculator, zero axe
violations.

### The in-browser verification method
No `chromium-cli` and no connected Chrome extension are available on this box. The working approach,
used for every UI change since 2026-09-22:

```
playwright-core (installed with --no-save, never touching package.json)
    → driving the system's snap Chromium at /snap/bin/chromium
    → headless, logs in as a seeded user, navigates, screenshots
    → asserts zero console errors
```

Every UI change is verified in **light theme, dark "Graphite" theme, and Arabic/RTL**, and —
where roles matter — as both `admin@example.com` and `storekeeper@example.com`. This method has
caught real bugs that type-checking could not: RTL chart mirroring, clipped Arabic labels, the
`LocationChip` truncation bug, the movement-quantity sign bug, the RTL minus-sign bidi bug, and a
403 fired by an admin-only query running under a store-keeper session.

---

## 19. The demo dataset

Built by `backend/prisma/seed.ts`. **Idempotent** — it wipes the demo-owned tables and rebuilds,
so it can be re-run safely. It never touches `AuditLog` or `StockMovement` deletions, which are
append-only.

### Contents (after the 2026-09-23 expansion)

| | |
|---|---|
| Organisation | 1 — "Demo Organization" / "مؤسسة تجريبية", `DEMO`, Asia/Dubai, AED |
| Location types | 3 — `STORE_ROOM > RACK > LEVEL` |
| Location nodes | **111** — 3 store rooms × 6 racks × 5 levels = 90 stock-holding shelves |
| Categories | **9** — Hot Beverages, Cold Beverages & Water, Dairy & Creamers, Sweeteners & Snacks, Disposables & Tissue, Cleaning Supplies, Office Consumables, Bakery & Kitchen, Safety & PPE |
| Units of measure | 7 — UNIT, BOX, CARTON, PACK, ROLL, BOTTLE, KG |
| Suppliers | **7**, lead times 2–7 days |
| Products | **75**, every one with a hand-assigned AED `unitCost` (AED 4.80 – 168.00) |
| Stock positions | 83 |
| Movement history | **150 days**, 8,160 rows |
| Cycle counts | **5 sessions** (4 closed, 1 open), 22 lines, 8 real variances → 8 audited `ADJUSTMENT` movements |
| Recommendations | 8, pre-seeded with the **real** engine so they match a live "Run now" exactly |
| Users | 2 |

### How the history is generated
Each product's daily quantity is `baseDailyUsage × weekdayFactor × trendFactor × noise`:

- **`weekdayFactor`** — 0.45× on Saturday and Sunday. The UAE work week has run Monday–Friday since
  January 2022, and a store room genuinely sees less activity on non-working days.
- **`noise`** — a 0.55–1.45× multiplicative band, so no two days look identical.
- **`trendFactor`** — applied to **five specific SKUs only** (`PRD-0006`, `-0013`, `-0031`, `-0043`,
  `-0049`), ramping 0.7× → 1.9× across the window. All five already sit at or below their reorder
  point, so the accelerating usage genuinely pushes their days-to-stockout into the 7–10 day band
  — arrived at by real usage maths, **not hand-set**. Every other product stays flat, which is what
  keeps most of the catalogue reading as healthy.
- Two `GOODS_IN` restocks per product (opening + mid-window) so the trend view shows real inbound
  activity, not just outflow.
- Inserted via chunked `createMany` (500/batch).

`dailyUsageBySku` sums only the **trailing 30 days**, not the full window — matching exactly what a
fresh manual run would compute today, so the pre-seeded recommendations stay honest.

### Verified figures (computed directly from the database)
- Days-to-stockout: the 5 accelerating SKUs land at **7–10 days**; ~40 products sit healthy (>30 days)
- Projected reorder spend: **AED 6,936** across the 8 products currently needing reorder, varying
  genuinely by supplier (AED 1,261–2,659) and category (AED 397–1,518)
- History depth: every product clears both the 30-day forecast minimum and the 90-day seasonality
  minimum with margin
- `forecast_daily_usage()` returns real floats for tested products; `detect_seasonal_uplift()`
  returns `True` only for the accelerating group — the seasonal signal is genuinely present in the
  data, not asserted

### Demo logins
| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@example.com` | `Admin@Mizan2026` |
| STORE_KEEPER | `storekeeper@example.com` | `Store@Mizan2026` |

**Demo credentials only.** Each database has its own users; real deployments must change them. The
navigation rail's "Demo logins" reveal is sourced from environment variables and the backend
**omits them entirely when `NODE_ENV=production`**.

### The multi-entity provisioner
`scripts/create-entity.ps1` + `backend/prisma/entity-seed.ts` — one command creates a database,
applies migrations, applies the append-only rules, and seeds an organisation, a default
`WAREHOUSE > AISLE > SHELF` hierarchy, units, and an admin plus store keeper. With `-Sample` it also
seeds a neutral catalogue (12 products, all with unit costs), ~120 days of movements, and
pre-seeded recommendations from the real engine. It prints the `.env` block and the logins.

Because the app's queries are **not organisation-scoped** (single-tenant per deployment), each
entity is a **separate database**, switched by editing `backend/.env` and restarting.

---

## 20. Running the system

Everything runs **natively** on this box — no Docker locally.

```bash
# 1. PostgreSQL 16 — already running as a system service on :5432

# 2. Backend (terminal 1)
cd /mnt/nvme/inventory/backend
npm install          # first time only
npm run db:seed      # first time / to reset the demo data
npm run start:dev    # → http://localhost:3000/api/v1

# 3. Frontend (terminal 2)
cd /mnt/nvme/inventory/frontend
npm install          # first time only
npm run dev          # → http://localhost:5173

# 4. AI service (terminal 3) — needed for the assistant and the Insights forecast panel
cd /mnt/nvme/inventory/ai-service
PYTHONPATH=. python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8000

# 5. Ollama — already running as a systemd service on :11434
```

Then open **http://localhost:5173** and log in.

### Useful commands
```bash
npm --prefix backend test                      # Jest unit tests
cd ai-service && python3 -m pytest -q          # pytest suite
npx tsc --noEmit -p backend/tsconfig.json      # backend type check
npx tsc --noEmit -p frontend/tsconfig.json     # frontend type check
npm --prefix backend run db:seed               # rebuild the demo dataset
```

### Ports
| Service | Port |
|---|---|
| Frontend (Vite) | 5173 |
| Backend API | 3000 (`/api/v1`, docs at `/api/v1/docs`) |
| AI service | 8000 |
| PostgreSQL | 5432 |
| Ollama | 11434 |

---

## 21. Environment variables

Template: `infrastructure/environment-templates/.env.example` (committed). Real `.env` files are
git-ignored. The backend reads `backend/.env` first, then falls back to `../.env.development`.

```bash
NODE_ENV=development
API_PORT=3000                       # PORT takes precedence if a host injects it

APP_NAME=Mizan
ORGANIZATION_CODE=DEMO

DATABASE_URL=postgresql://mizan:CHANGEME@postgres:5432/mizan_inventory
REDIS_URL=redis://redis:6379

JWT_SECRET=CHANGEME
JWT_REFRESH_SECRET=CHANGEME
MFA_ENABLED=false
SESSION_IDLE_TIMEOUT_MINUTES=30
ACCOUNT_LOCKOUT_ATTEMPTS=5

SMTP_HOST= / SMTP_PORT=587 / SMTP_USER= / SMTP_PASSWORD= / SMTP_FROM=

MINIO_ENDPOINT=minio / MINIO_ACCESS_KEY= / MINIO_SECRET_KEY= / MINIO_BUCKET=

AI_SERVICE_URL=http://ai-service:8000        # Docker hostname
OLLAMA_URL=http://ollama:11434
# Native run on this Jetson — override to:
# AI_SERVICE_URL=http://localhost:8000
# OLLAMA_URL=http://localhost:11434

LANGUAGE_MODEL_PROFILE=llama-development     # or qwen-production
SERVICE_ACCOUNT_EMAIL=admin@example.com
SERVICE_ACCOUNT_PASSWORD=CHANGEME

REPLENISHMENT_RUN_TIME=07:00
TZ=Asia/Dubai
DEFAULT_LANGUAGE=en
CORS_ORIGIN=http://localhost:5173
```

> ⚠️ **A native-run gotcha that bit once and will bite again.** The shared `.env.development`
> defaults `AI_SERVICE_URL` to the **Docker Compose hostname** `http://ai-service:8000`, which does
> not resolve when running natively. Without a `backend/.env` override this silently breaks every
> backend → ai-service call (the Insights forecast panel, and the assistant). The current
> `backend/.env` sets `AI_SERVICE_URL=http://localhost:8000`. **That file is git-ignored, so a
> fresh clone will need the same override.**

**Switching the language model is one variable.** No feature code anywhere names a model — the only
place a model tag appears is `ai-service/src/language_model/model_profiles.py`.

---

## 22. Version control state

- **Remote:** `https://github.com/ismayil-gpt/inventory-management-procductize`
- **Branch:** `main`
- **Local HEAD:** `091d036`
- **14 commits, 8 ahead of `origin/main` — not yet pushed**

### Recent history
```
091d036  docs: session notes for the movement history browsing screen
7eed27c  feat(frontend): movement history browsing screen (resolves OPEN-QUESTIONS #16)
ef900a2  docs: session notes for the widened demo dataset
b16bb00  feat(seed): 75 products, a third store room, 150-day history, real cycle counts
7d25baf  docs: Predictive Analytics Dashboard session notes, resolve OPEN-QUESTIONS #13
9ae1a43  feat(frontend): Predictive Analytics Dashboard + unit cost across product UI
f4ace50  feat(backend): unit cost writes, predictive analytics endpoints, Jest setup
d4a9386  feat(ai-service): forecast-vs-actual endpoint for the Predictive Analytics Dashboard
e6b7378  feat: product unit cost + 120-day seed history for demand forecasting
cad0ed2  style: pronounced corner radius, per revised client decision
40ef6d9  feat: dashboard backend data for the movement/category/pipeline charts
0fcbb3e  fix: LocationChip was hiding the store room on 3-segment designators
d03bf30  Dashboard Update
8b0de34  feat: initial commit of Mizan inventory management system
66dea6f  chore: initial import ... first customer DCAA        ← see the warning below
```

### ⚠️ An unresolved repository issue

A local branch `backup-github-main` exists that was **not created by any recent session** — its
reflog says only "Created from origin/main". It points at a **single root commit `66dea6f`, dated
2026-08-27**, titled "initial import of Mizan inventory management system… first customer DCAA",
authored in a prior session.

It contains **180 files**, several of which **do not exist anywhere in this working directory**:
`EDGE-DEMO-SCRIPT.md`, `backend/prisma/edge-seed.ts`, `backend/prisma/enoc-seed.ts` (client-named
seed variants — possibly EDGE Group and ENOC), and a `files/` directory with
`DCAA_Database_Data_Dictionary.xlsx` plus several CSVs and a `seed.sql`.

**That commit is not an ancestor of the current `main`**, locally or on GitHub. At some point
GitHub's `main` was pointed at this working directory's unrelated history instead. The commit is
still fetchable by SHA but is not reachable from any branch there.

**Action taken: none.** `backup-github-main` was left exactly as found — no push, delete, or
force-push attempted. **This needs the owner's decision** before any further git history operations
on this repository: do you recognise this, and do the DCAA/EDGE/ENOC files need recovering?

### Git conventions
Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `style:`). Branches
`feature/<phase>-<slug>`. TLS keys, `.env*`, `node_modules`, build output, and Python caches are
git-ignored. *(A self-signed dev TLS private key was once caught staged and removed before it left
the machine — hence the explicit ignore.)*

---

## 23. Open questions

Full detail in [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md). **16 entries; #13 and #16 are resolved.**
None are blocking.

| # | Question | Conservative choice taken | Needs |
|---|---|---|---|
| 1 | Exact rack/level counts per store room | Seeded per spec | Each customer |
| 2 | Is "Mizan" the customer-facing brand? | Mizan = platform brand; each org is white-labelled | Client |
| 3 | Database naming (`dcaa` vs `mizan`) | `mizan` / `mizan_inventory` | — low impact |
| 4 | SMTP relay host + credentials | Blank; wired but inert | Each deployment's IT |
| 5 | Which officer receives the daily notification, and by what channel | In-app to ADMIN for MVP | Client |
| 6 | Prisma schema location (spec says `database/schema/`) | Moved to `backend/prisma/` — the standard layout; the spec path caused a module-resolution bug | — engineering |
| 7 | Where the reorder engine lives (spec §3.3 says ai-service) | **Backend** — transparent maths, no GPU needed, verifiable today | — engineering |
| 8 | `qwen-production` model tag (spec named 14B) | `qwen2.5:1.5b` — see §15 | ✅ user confirmed |
| 9 | Assistant intent routing (spec lists FAISS + sentence-transformers) | Skipped both; stdlib `difflib` instead | — engineering |
| 10 | Assistant generality beyond a fixed intent menu | Added Ollama tool-calling as a second tier, keyword router first | — validated live |
| 11 | Arabic general-chat fabricated category names | Arabic general-chat **skips LLM generation entirely**, returns a fixed safe message | — safety-motivated |
| 12 | "Which product is critical" failed 7 ways | Added "critical"/"out of stock" to the keyword router + severity filter | — validated live |
| 13 | ~~Predictive Analytics Dashboard doesn't exist~~ | **✅ RESOLVED** — built 2026-09-23 | — |
| 14 | Orphaned `StockMovement` rows accumulate on re-seed | Left as-is — cannot delete without violating DESC #10 | You, if a perfectly clean DB matters |
| 15 | Should Insights be ADMIN-only? | Visible to both roles, matching the Dashboard | You / client |
| 16 | ~~No movement-history browsing screen~~ | **✅ RESOLVED** — built 2026-09-23 | — |

### The one open definitional question worth a decision
**What "Projected spend" means.** The Insights panel computes **recommended order quantity × unit
cost**, summed only over products that need reordering *right now* (8 of 75), using the same
`calculateReorder` the replenishment engine uses. An earlier sanity-check used a different proxy —
`dailyUsage × unitCost × 30`, a flat 30-day burn across the whole catalogue, which produced
AED 29,702/month. The shipped number is the more defensible one for a real approval flow, and the
KPI is deliberately labelled "Projected reorder spend" **without** a "(30 days)" qualifier, because
the underlying formula is not a strict 30-day figure and overclaiming what a number means would
violate the determinism principle. **Confirm this reads correctly as an investor number.**

---

## 24. Known gaps and what is deliberately not built

### Deferred (real work, not yet done)
- **Production packaging** — `docker-compose.production.yml`, nginx configuration, real TLS,
  encrypted volumes, automated encrypted backups with a tested restore. This is the single largest
  outstanding block and also unlocks the organisation logo upload (needs MinIO).
- **DESC hardening** — Redis JWT denylist (control 4), frontend idle timeout (6), rate limiting on
  `/auth/*` (12), Pino log hygiene (15), dependency scanning (16), backup procedure (17), MFA
  enablement (7), tightening the `mizan` role's CREATEDB grant (19).
- **Test coverage** — backend integration (Testcontainers), frontend unit (Vitest), end-to-end
  (Playwright), and an automated axe-core accessibility pass. Only the two unit suites exist today.
- **Self-hosted IBM Plex fonts** in `frontend/public/fonts` (spec requires no external font CDN).
- **The Arabic quality gate** — must be re-run and pass before the assistant is presented to a
  client in Arabic (§15).

### Deliberately not built (scoped out, per spec §5A.6 / §13.6)
Multi-tenant data isolation (row-level security, tenant-scoped connections) · customer self-service
sign-up · white-labelling beyond the organisation name and logo · licensing, entitlement, or
metering · cross-customer reporting or a management console · RFID · expiry/batch tracking ·
external ERP integration · native app-store mobile apps · Arabic-language PDF/Excel generation.

`organizationId` exists on every tenant-owned table **from day one**, so these become possible later
without a painful migration. **Scoped, not built.**

### Other known conditions
- **Barcode scanning is manual-entry only.** The Scan tab is deliberately stubbed ("Scanner not
  connected — device coming soon") until the wireless HID unit is purchased. The keystroke-speed
  detection logic the spec describes is designed but the hardware path is unexercised.
- **There is no in-app purchase-order viewer.** It was removed by request; PO generation and
  emailing remain.
- **4,899 orphaned `StockMovement` rows** in the dev database (§2).
- **8 commits are unpushed**, and the repository-history question (§22) is unresolved.

---

## 25. Roadmap

### Phase status
| Phase | Scope | Status |
|---|---|---|
| **0** — Foundation | Repo structure, schema, migrations, append-only rules, seed, tokens, translations, shell, auth, health checks | ✅ Complete |
| **1** — Inventory core | Location-type config, tree management, bulk create, categories, units, custom attributes, products, import, labels, all five movement types, scanning, offline outbox | ✅ Complete |
| **2** — AI Store Manager | Provider abstraction, daily review, reorder calculator, bilingual reasoning, recommendations, approve/amend/reject, suppliers, PO generation, SMTP | ✅ Complete |
| **3** — Dashboard, reporting, hardening | Dashboard, PDF/Excel reports, audit viewer, user management, cycle counts | ✅ Functionally complete; **DESC evidence and the accessibility pass are not** |
| **Stage 2** — post-MVP | Production environment, `qwen-production`, LM validation gate, demand forecasting, seasonal config, forecast-driven recommendations, assistant refinement | ◐ Built and running; **gate does not pass**; production environment deferred |
| **Product phase** — commercially separate | Multi-tenancy, onboarding, white-labelling, licensing, deployment automation | ⬜ Not started, by design |

### Suggested next steps, in order
1. **Push the 8 pending commits** — after resolving the repository-history question (§22).
2. **Production packaging** — Docker Compose, nginx, TLS, encrypted volumes, backups. Unblocks the
   most DESC controls at once and unlocks logo upload.
3. **DESC hardening sprint** — controls 4, 6, 12, 15, 16, 17 and their evidence files. These need no
   GPU and no new hardware.
4. **Test suites** — integration, frontend unit, e2e, and the axe pass. The `definition of done`
   in CLAUDE.md §17 requires them.
5. **Re-run the Arabic quality gate** and record the result.

---

## 26. Key decisions and the reasoning behind them

These are the "why"s that are expensive to rediscover.

| Decision | Reasoning |
|---|---|
| **Configuration over code** | Storage shape, catalogue, vocabulary, and branding are data. This is what makes Mizan a product rather than a bespoke build, and it is the strongest thing to sell. If you are writing `if (type === 'STORE_ROOM')`, it belongs in the database. |
| **Deterministic over generative** | The reorder engine is transparent maths — auditable, reproducible, identical on any model, and defensible to a regulator. The LLM only *phrases* real data; it never invents figures. This is also why procurement works with no GPU at all. |
| **Auditability over convenience** | Every state change is logged in the same transaction. Audit and movement history are append-only, enforced **by the database itself**, not by application discipline. Deletion is guarded; deactivation is the default. |
| **In-app JWT, not Keycloak** | Five users, on-premise, email and password. Keycloak's operational burden is not justified at this scale, and every DESC control is satisfiable in-application. MFA is built now so it can be switched on for certification without rework. |
| **The reorder engine in the backend, not the AI service** | It is template maths, identical in any language, and runs and verifies with no GPU or Ollama. The Python service keeps the spec's structure and owns the scheduled trigger plus the genuinely LLM-dependent work. |
| **A smaller model, chosen on reliability** | 14B and 7B do not fit. 3B fits but crashed under real load. Further quantization made quality *worse*, and `q3_K_M` hallucinated a number — a correctness violation, not a style regression. 1.5B never crashed and never invented a figure. Reliability beat fluency. |
| **Arabic general-chat skips the LLM entirely** | Prompting alone did not stop fabrication, even after a retry. A deterministic safe message costs real UX (genuine small talk gets a canned reply) and that cost was accepted over fabrication risk. |
| **Keyword routing before tool-calling** | Tool-calling-first caused a measurable regression on cases the keyword router already handled exactly. Precision first, generality second. |
| **On-premise is the product** | Cloud hosting exists only as a demo convenience (`hosting/`), switched purely by configuration, and is kept out of the product architecture. Host demo data only, never real client data. |
| **Deviations get flagged, not silently applied** | The corner-radius change contradicted a written client decision, so it was raised before anything was edited. The model choice contradicted the spec, so it was documented with the full test ladder. Spec deviations live in `OPEN-QUESTIONS.md` with their reasoning. |
| **Verify in the browser, in both languages and both themes** | Type-checking cannot catch RTL mirroring, clipped labels, bidi sign reordering, or a 403 that only fires for one role. Every one of those was a real bug found this way. |

---

## 27. Glossary

| Term | Meaning |
|---|---|
| **Designator** | A location's full coded address — ancestor codes joined by `-`, e.g. `SR1-R1-L1`. Cached on the node, recomputed on rename or move. Never translated or mirrored. |
| **Materialised path** | `/rootId/childId/leafId` stored on every node, making subtree queries a single indexed `LIKE`. The application never recurses. |
| **`canHoldStock`** | The `LocationType` flag marking which level of the hierarchy actually stores goods. Only those nodes get barcodes and stock positions. |
| **Effective ROP** | `max(reorderPoint, ceil(leadTimeDemand + safetyStock))` — the threshold the reorder engine actually compares against, which can exceed the configured reorder point when usage is high. |
| **Outbox** | The Dexie/IndexedDB queue every movement is written to *before* syncing, so scanning works offline. Its depth is always visible in the status strip. |
| **`clientId`** | A device-generated UUID on every movement, making `POST /stock-movements` idempotent so an offline retry cannot double-apply. |
| **Append-only** | `AuditLog` and `StockMovement` have PostgreSQL rules making `UPDATE` and `DELETE` no-ops. Enforced at the database, not in application code. DESC control #10. |
| **DESC** | Dubai Electronic Security Center — the 20 technical controls in §17. |
| **Pseudo mode** | `?pseudo=1` lengthens every string 40% to catch layout breakage before it reaches Arabic. |
| **Graphite** | The dark theme's name — neutral warm-grey panels with a teal-cyan accent, chosen by the client. |

---

*Generated 2026-09-24 from the live repository, the live database, and the running services.
For dated, blow-by-blow detail see [`PROGRESS.md`](PROGRESS.md). For the binding specification see
[`CLAUDE.md`](CLAUDE.md) — where they disagree, CLAUDE.md wins.*
