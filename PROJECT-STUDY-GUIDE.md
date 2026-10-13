# Mizan — Complete Project Reference

> **The one file with every detail of this project**: what it is, where it stands, how it is
> built and run, every table, endpoint, screen, control and decision, what is missing, and
> what comes next.
>
> **Rewritten 2026-10-12** against the live repository, the live development database and the
> running services on the Jetson. Every count, version and path below was read from the system
> that day. It replaces the 2026-09-24 edition, which predated the airfield and clay designs,
> the DESC hardening, production packaging and the demo video.
>
> **Companion documents** (this file summarises them; each stays authoritative in its scope):
> [`CLAUDE.md`](CLAUDE.md) (the binding specification; if this file and CLAUDE.md disagree,
> CLAUDE.md wins) · [`PROGRESS.md`](PROGRESS.md) (dated build log) ·
> [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) (decisions awaiting an owner) ·
> [`THINGS-TO-DO.md`](THINGS-TO-DO.md) (plain-language checklist) ·
> `documentation/` (guides, DESC evidence, acceptance pack).

---

## Contents

1. [What Mizan is](#1-what-mizan-is)
2. [Status at a glance](#2-status-at-a-glance)
3. [The core business loop](#3-the-core-business-loop)
4. [Hardware and environments](#4-hardware-and-environments)
5. [Technology stack](#5-technology-stack)
6. [Architecture and data flow](#6-architecture-and-data-flow)
7. [Repository structure](#7-repository-structure)
8. [Data model](#8-data-model)
9. [The configurable hierarchy](#9-the-configurable-hierarchy)
10. [API surface](#10-api-surface)
11. [Backend modules](#11-backend-modules)
12. [Frontend screens](#12-frontend-screens)
13. [Barcode scanning and offline operation](#13-barcode-scanning-and-offline-operation)
14. [Design system — the Clay edition](#14-design-system--the-clay-edition)
15. [Brand and logo](#15-brand-and-logo)
16. [Bilingual — English and Arabic](#16-bilingual--english-and-arabic)
17. [The AI — three engines](#17-the-ai--three-engines)
18. [Business rules](#18-business-rules)
19. [Security and DESC compliance](#19-security-and-desc-compliance)
20. [Accessibility](#20-accessibility)
21. [Testing](#21-testing)
22. [The demo dataset](#22-the-demo-dataset)
23. [Running the system](#23-running-the-system)
24. [Production deployment](#24-production-deployment)
25. [Environment variables](#25-environment-variables)
26. [Version control](#26-version-control)
27. [Client-facing material](#27-client-facing-material)
28. [Open questions](#28-open-questions)
29. [Known gaps](#29-known-gaps)
30. [Roadmap and next steps](#30-roadmap-and-next-steps)
31. [Key decisions and why](#31-key-decisions-and-why)
32. [Project timeline](#32-project-timeline)
33. [Glossary](#33-glossary)

---

## 1. What Mizan is

**Mizan** (ميزان, Arabic for *balance* or *scales*) is an **on-premise, AI-assisted inventory
management system** for store rooms and warehouses, built and sold by **Grow Plus Technologies**
(gptechnologies.ae, +971 4 259 9011). The first deployment is an aviation authority's two
consumables store rooms (coffee, sugar, cleaning supplies, stationery).

| Property | What it means |
|---|---|
| **A product, not a one-off** | Storage structure, product catalogue and vocabulary are configuration rows, never code. The same build runs a store room, a hospital dispensary or a distribution centre with aisles and bins. |
| **On-premise** | No cloud services, no external calls at runtime. The only outbound traffic is SMTP, to email purchase orders to suppliers. |
| **Bilingual** | English and Arabic, both complete, with full right-to-left layout. |
| **DESC-compliant** | The 20 Dubai Electronic Security Center technical controls are built into every layer, with evidence filed as each control lands. |

**The governance rule:** the AI recommends; a human always approves. The system never places an
order by itself.

### Scale of the first deployment (configuration, not limits)

| Fact | Value |
|---|---|
| Store rooms | 2 in the specification (the demo data has 3) |
| Racks per room / levels per rack | about 6 / about 5 |
| Products | about 50 at launch (demo: 75) |
| Units | 1,000–2,000 |
| Named users | up to 5 |
| Roles | `ADMIN`, `STORE_KEEPER` |

---

## 2. Status at a glance

**The MVP (Phases 0–3) is complete and tested, except the structure-administration screens
(location types, categories, units, custom attributes), which are seed-only today (§29).** The Stage 2 AI (assistant and demand
forecasting) is built and has run on the Jetson; the assistant does not yet pass the Arabic
quality gate and currently cannot load its model on this board (§17). Production packaging is
written but has never run on real hardware (§24).

| Area | State on 2026-10-12 |
|---|---|
| Phases 0–3 (MVP) | ✅ Complete, except the structure-administration screens (§29) |
| DESC controls | 9 verified with evidence, 11 implemented (production-only ones checked statically) — §19 |
| Accessibility | ✅ axe: 0 violations on every screen and pop-up, English light and Arabic dark; keyboard, focus and tablet tests pass |
| Design | Clay edition with the scannable-carton logo (approved 2026-10-03) |
| Client acceptance pack | Demo script, 27-point checklist, store-keeper and administrator guides, 2:35 demo video |
| Production install | ⏳ Never run on target hardware |
| Assistant on this board | ⚠️ Model fails to load (GPU memory, §17); Arabic gate does not pass |

### Codebase size (tracked files, 2026-10-12)

| Area | Files | Lines (code, styles, docs) |
|---|---:|---:|
| `frontend/src` | 63 | 7,452 |
| `backend/src` | 94 | 5,405 |
| `ai-service/src` | 21 | 1,502 |
| `shared/` (tokens, translations) | 3 | 1,443 |
| `scripts/` | 10 | 376 |
| `documentation/` | 23 | 1,918 |

51 commits on the working branch; 5 Prisma migrations plus the append-only rules.

### What runs on the board

| Service | Port | How |
|---|---|---|
| Frontend (Vite dev server) | 5173 | `npm run dev` |
| Backend (NestJS) | 3000 (`/api/v1`, docs at `/api/v1/docs`) | `node dist/src/main` |
| PostgreSQL 16.15 | 5432 | system service |
| AI service (FastAPI) | 8000 | `uvicorn`, started by hand; **not a system service**, so it stops on reboot |
| Ollama 0.33.2 | 11434 | systemd service |

### Live development database (2026-10-12)

| Table | Rows | | Table | Rows |
|---|---:|---|---|---:|
| Organization | 1 | | Product | 75 |
| User | 3 | | StockPosition | 83 |
| AuthSession | 21 | | StockMovement | 8,092 |
| LocationType | 3 | | Recommendation | 8 |
| LocationNode | 111 | | PurchaseOrder | 1 |
| ProductCategory | 9 | | CycleCount / lines | 5 / 22 |
| UnitOfMeasure | 7 | | AuditLog | 27 |
| ProductAttributeDefinition | 0 | | Append-only rules | 4 |
| Supplier | 7 | | | |

The organisation is currently named **Grow Plus Technologies / جرو بلس تكنولوجيز**, code `GPT`
(set for the demo video; §22).

---

## 3. The core business loop

1. Every product and every stock-holding location carries a barcode.
2. A Store Keeper scans a location, then products, and records a movement: goods in, goods out,
   transfer, cycle count or adjustment.
3. Stock and its exact location update at once; an immutable audit record is written in the same
   database transaction.
4. Every day at 07:00 Gulf Standard Time the **AI Store Manager** reviews stock, consumption and
   supplier lead times and works out what to reorder.
5. Each recommendation carries its reasoning in plain English and Arabic.
6. An Administrator approves, amends the quantity, or rejects.
7. Approved items become one PDF purchase order per supplier, emailed to that supplier.
8. Goods arrive, are scanned in, and the loop closes.

---

## 4. Hardware and environments

### The board (in hand, in use)

| | |
|---|---|
| Device | **NVIDIA Jetson Orin Nano**, 8 GB unified memory (7.4 GiB visible), shared by CPU and GPU |
| Architecture | `aarch64` |
| OS | Ubuntu 22.04, kernel `5.15.148-tegra`, JetPack R36 revision 4.7 |
| Disk | NVMe at `/mnt/nvme` (469 GB, about 4 % used) |
| Desktop | GNOME with Chromium, which competes for the same memory as the GPU |

The 8 GB of **unified** memory is the most consequential hardware fact: the GPU can only use
memory that is genuinely free, so the language model competes with the desktop, the browser and
the file cache (§17).

### Runtimes

| Runtime | Version |
|---|---|
| Node.js | 20.20.2 (NestJS 12 needs 22; deferred to production, OPEN-QUESTIONS #22) |
| Python | 3.10.12 |
| PostgreSQL | 16.15 |
| Ollama | 0.33.2 |
| ffmpeg (user install, video only) | 7.0.2 static, `~/.local/bin/ffmpeg` |

### Ollama models on disk

`qwen2.5:1.5b` (0.99 GB, **the production profile**), `qwen2.5:3b`, `qwen2.5:3b-instruct-q3_K_M`,
`qwen2.5:3b-instruct-q2_K`, `qwen2.5:7b`, `qwen2.5:7b-instruct-q3_K_S`. The larger ones remain
from capacity testing (§17); only 1.5b is used.

### Development and production

The architecture never changes between environments; only configuration does.

| | Development (this board, today) | Production (target server) |
|---|---|---|
| How it runs | Natively: npm, uvicorn, systemd Ollama | `docker-compose.production.yml` |
| Language model | `qwen-production` profile (`qwen2.5:1.5b`) | same profile, on the server's GPU |
| TLS | none locally | real certificate at nginx, TLS 1.2+, HSTS |
| Disk | unencrypted | data directory must be on LUKS (checked by `check-production-host.sh`) |
| Secrets | `backend/.env`, `ai-service/.env.development` (git-ignored) | injected at deploy |
| Redis, MinIO | not used anywhere (OPEN-QUESTIONS #23) | not used |

---

## 5. Technology stack

### Frontend

| Concern | Choice | Version |
|---|---|---|
| Framework | React + TypeScript (strict) | 18.3 |
| Build | Vite | 5.4 |
| Routing | React Router | 7.18 (upgraded from 6 on 2026-10-01) |
| Server state | TanStack Query | 5.51 |
| Client state | Zustand (theme, language, auth, offline queue, assistant) | 4.5 |
| Styling | Tailwind CSS with the default palette disabled; most components use inline styles on the tokens | 3.4 |
| Translation | i18next / react-i18next | 23.12 / 14.1 |
| Charts | Recharts | 2.15 |
| Icons | Lucide React | 0.427 |
| Offline storage | Dexie (IndexedDB) | 4.4 |
| Fonts (self-hosted via @fontsource) | Figtree, Fredoka, DM Mono, IBM Plex Sans Arabic | 5.3 |
| Tests | Vitest, Testing Library, Playwright, axe-core | 3.2, 16.3, 1.63, 4.13 |

### Backend

| Concern | Choice | Version |
|---|---|---|
| Framework | NestJS (strict TypeScript) | 11.2.7 (from 10 on 2026-10-01) |
| ORM | Prisma | 5.22 |
| Database | PostgreSQL | 16.15 |
| Auth | Passport JWT, server-side sessions in PostgreSQL | passport-jwt 4.0 |
| Passwords | `@node-rs/argon2` (argon2id) | 2.0 |
| Two-step sign-in | otplib (TOTP), qrcode (drawn on the server) | 12.0, 1.5 |
| Validation | Zod via a `ZodValidationPipe` | 3.25 |
| Rate limiting | `@nestjs/throttler` | 6.7 |
| Logging | Pino via nestjs-pino, with redaction | 9.14 / 4.6 |
| Secure headers | Helmet | 7.1 |
| Barcodes | bwip-js (Code128) | 4.11 |
| PDF / Excel | PDFKit / ExcelJS | 0.15 / 4.4 |
| Email | Nodemailer (STARTTLS required by default) | 10.0 |
| API docs | `@nestjs/swagger` | 11.4 |
| Tests | Jest + ts-jest | 30.5 / 29.4 |

Not used, although the specification lists them: Redis/BullMQ, MinIO, React Hook Form, a shared
`data-contracts` package (Zod schemas live per module).

### AI service

| Concern | Choice | Version |
|---|---|---|
| Framework | FastAPI on Starlette | 0.142.2 / 1.7.0 |
| Server | uvicorn | 0.30.6 |
| Models and settings | Pydantic / pydantic-settings | 2.9.2 / 2.5.2 |
| Scheduling | APScheduler | 3.10.4 |
| HTTP client | httpx | 0.27.2 |
| Forecasting | statsmodels (with pandas and NumPy) | 0.14.2 |
| Language model runtime | Ollama, local only | 0.33.2 |
| Tests | pytest, pytest-asyncio | 9.1.1, 1.4.0 |

Deliberately not installed: `sentence-transformers` and FAISS (OPEN-QUESTIONS #9). Product-name
matching uses the standard library's `difflib`.

---

## 6. Architecture and data flow

```
                    Browser: React single-page app (:5173)
                              │  /api/v1/*  (Vite proxies to :3000)
                              ▼
        ┌──────────────── NestJS backend (:3000) ─────────────────┐
        │  Prisma ─────────────────────────► PostgreSQL (:5432)    │
        │                                     mizan_inventory      │
        │  Nodemailer ─────────────────────► SMTP relay            │
        │                                     (the only outbound)  │
        │  ai-service-client ──────────────► AI service (:8000)    │
        └──────────────────────────────────────┬───────────────────┘
                                               │
                              ┌────────────────┴────────────────┐
                              │ FastAPI AI service              │
                              │  · assistant                    │
                              │  · demand forecasting           │
                              │  · 07:00 daily review trigger   │
                              │        │                        │
                              │        ▼                        │
                              │  Ollama (:11434) qwen2.5:1.5b   │
                              └─────────────────────────────────┘
```

**Key facts**

- **The deterministic reorder engine lives in the backend**, not the AI service: it is template
  maths, needs no GPU and can be verified anywhere (OPEN-QUESTIONS #7). The AI service owns the
  scheduled trigger and the work that genuinely needs a language model.
- **The AI service is never reachable from outside.** Only the backend calls it.
- **The AI service reads data through the backend API**, signed in as the service account
  `ai-service@example.com`. It never touches the database, so every figure it sees passed the
  same guards and validation as a user's request.
- **There are no foreign-key constraints.** References are plain string ids; deletion is guarded in
  application code (§18).

### Production topology (`docker-compose.production.yml`)

| Service | Role | Networks |
|---|---|---|
| `nginx` | TLS termination, security headers, the only published ports (443, 80 → 443) | public, edge |
| `frontend` | built static app | edge |
| `migrate` | one-shot: migrations and append-only rules as `mizan_owner` | data |
| `backend` | API, as least-privilege role `mizan_app` | edge, data, mail |
| `ai-service` | assistant, forecasting, scheduler | edge |
| `ollama` | language model on the GPU | edge |
| `postgres` | database, data under `MIZAN_DATA_DIRECTORY` | data |
| `backup` | daily encrypted backup as read-only `mizan_backup` | data |

`edge` and `data` are internal networks; the AI service and Ollama have no route to the internet;
only the backend reaches the `mail` network.

---

## 7. Repository structure

```
inventory/                                 (GitHub: ismayil-gpt/inventory-management-procductize)
├── CLAUDE.md                              binding specification (1,393 lines)
├── PROJECT-STUDY-GUIDE.md                 this file
├── PROGRESS.md · OPEN-QUESTIONS.md · THINGS-TO-DO.md · README.md · HOW-TO-RUN.md
├── docker-compose.development.yml         nginx, frontend, backend, ai-service, postgres
├── docker-compose.production.yml          §6 and §24
├── frontend/
│   ├── public/logo/                       mizan-mark.svg (also the favicon), mono mark, lockup
│   ├── e2e/                               7 Playwright specs (§21)
│   └── src/
│       ├── application-shell/             rail, top bar, status strip, idle timeout, preferences
│       ├── features/                      18 feature folders (§12)
│       ├── design-system/                 airfield-signs, brand-mark, confirm-dialog, drawer,
│       │                                  location-designator, modal, scan-signal,
│       │                                  stock-status-indicator
│       ├── offline-queue/                 Dexie outbox and sync
│       ├── internationalisation/          i18next setup, direction handling, pseudo mode
│       ├── api-client/                    typed calls to the backend
│       └── styles/global.css              clay relief, signs, motion, scrollbars, print sheet
├── backend/
│   ├── prisma/                            schema.prisma, 5 migration folders, seed.ts, entity-seed.ts
│   └── src/
│       ├── modules/                       one folder per capability (§11)
│       ├── security/                      rate-limiting, log-hygiene, Zod pipe
│       ├── documents/pdf-brand-mark.ts    the carton mark on PDFs
│       ├── email/ · database/ · ai-service-client/
├── ai-service/
│   ├── src/                               assistant/, demand_forecasting/, replenishment/,
│   │                                      language_model/, shared/, main.py
│   └── tests/                             3 files, 44 tests
├── shared/
│   ├── design-tokens/design-tokens.css    the single source of colour, type, radius, motion
│   └── translations/english.json, arabic.json
├── database/
│   ├── migrations/0001_append_only_rules.sql
│   ├── production/                        least-privilege roles, post-migration grants
│   └── LOCAL-DATABASE-SETUP.md
├── infrastructure/
│   ├── nginx/                             nginx.production.conf, security-headers.conf
│   ├── docker/                            Dockerfiles
│   └── environment-templates/.env.example
├── scripts/                               §23 (backup, restore, reset, scan, host check, …)
├── documentation/
│   ├── security-compliance/               DESC evidence (§19)
│   ├── administrator-guide/               administrator-guide.md, production-deployment.md
│   ├── store-keeper-guide/
│   ├── client-acceptance/                 demo-script.md, acceptance-checklist.md
│   └── gpu-readiness-and-upgrades.md
├── hosting/                               optional public demo hosting (Firebase), demo data only
├── brand/                                 the carton logo files (copies of frontend/public/logo/)
└── audit/                                 git-ignored visual audit of 2026-09-25 (86 screenshots)
```

Naming rules (CLAUDE.md §3.4): kebab-case files, PascalCase components, names that say what the
file does; no `utils`, `helpers` or `misc`.

---

## 8. Data model

Prisma schema at `backend/prisma/schema.prisma` (the specification's `database/schema/` caused a
module-resolution bug, OPEN-QUESTIONS #6).

### Migrations

| Migration | Adds |
|---|---|
| `20260730110858_init` | the core schema |
| `20260801055236_cycle_counts` | `CycleCount`, `CycleCountLine` |
| `20260923062617_add_product_unit_cost_and_org_currency` | `Product.unitCost`, `Organization.currency` |
| `20261001084802_auth_sessions` | `AuthSession` (DESC #4) |
| `20261001085436_mfa_enrollment` | `User.mfaEnabledAt`, `User.mfaLastUsedStep` (DESC #7) |
| `database/migrations/0001_append_only_rules.sql` | rules making `UPDATE`/`DELETE` no-ops on `AuditLog` and `StockMovement` (DESC #10) |

### Enums

`Role` ADMIN · STORE_KEEPER — `MovementType` GOODS_IN · GOODS_OUT · TRANSFER · CYCLE_COUNT ·
ADJUSTMENT — `BarcodeSource` MANUFACTURER · INTERNAL — `RecommendationStatus` PENDING · APPROVED ·
AMENDED · REJECTED · ORDERED · RECEIVED — `CycleCountStatus` OPEN · CLOSED.

### Tables

| Model | Fields | Notes |
|---|---|---|
| `User` | id, email, passwordHash, displayName, role, preferredLanguage, preferredTheme, isActive, mfaSecret (AES-256-GCM), mfaEnabledAt, mfaLastUsedStep, failedLoginCount, lockedUntil, lastLoginAt, createdAt | email unique |
| `AuthSession` | id, userId, refreshTokenHash, createdAt, lastUsedAt, expiresAt, revokedAt, revokedReason | server-side sessions (DESC #4) |
| `Organization` | id, code, nameEn, nameAr, timezone, defaultLanguage, currency, logoObjectKey, isActive, createdAt | one row per deployment |
| `LocationType` | id, organizationId, code, nameEn, nameAr, depth, canHoldStock, codePattern, sortOrder, isActive | the hierarchy's shape (§9) |
| `LocationNode` | id, organizationId, parentId, locationTypeId, code, nameEn, nameAr, materialisedPath, designator, depth, barcode, isActive, sortOrder, createdAt | unique (parentId, code); barcode unique |
| `ProductCategory` | id, organizationId, parentId, code, nameEn, nameAr, materialisedPath, sortOrder, isActive | nests to any depth |
| `UnitOfMeasure` | id, organizationId, code, nameEn, nameAr, isBaseUnit | |
| `ProductAttributeDefinition` | id, organizationId, key, labelEn, labelAr, dataType, selectOptions, isRequired, sortOrder | custom product fields; none defined in the demo |
| `Product` | id, organizationId, sku, barcode, barcodeSource, nameEn, nameAr, categoryId, baseUnitId, packSize, reorderPoint, minLevel, maxLevel, unitCost, supplierId, customAttributes, isActive | unique (organizationId, sku); barcode unique |
| `StockPosition` | id, productId, locationNodeId, quantity, updatedAt | unique (productId, locationNodeId) |
| `StockMovement` | id, clientId, type, productId, fromLocationNodeId, toLocationNodeId, quantity, reason, userId, createdAt | **append-only**; clientId unique (idempotency) |
| `Supplier` | id, name, email, phone, leadTimeDays, isActive | |
| `Recommendation` | id, productId, suggestedQty, approvedQty, reasonCode, reasoningEn, reasoningAr, status, generatedAt, decidedByUserId, decidedAt, purchaseOrderId | |
| `PurchaseOrder` | id, poNumber, supplierId, status (DRAFT, SENT), pdfKey, sentAt, createdAt | PDFs generated on demand, not stored |
| `AuditLog` | id, actorId, action, entityType, entityId, before, after, ipAddress, createdAt | **append-only** |
| `CycleCount` | id, organizationId, status, note, createdByUserId, createdAt, closedAt | |
| `CycleCountLine` | id, cycleCountId, productId, locationNodeId, countedQty, systemQty, createdAt | |

`organizationId` sits on every tenant-owned table from day one, so multi-tenancy can come later
without a painful migration. Queries are **not** organisation-scoped today: one deployment, one
database.

---

## 9. The configurable hierarchy

> Any customer can model their own storage (one store room, ten, or warehouses with aisles and
> bins) through the administration screens, without a developer, a migration or a code change.

| Customer | Location types | Designator |
|---|---|---|
| Store room (the demo) | `STORE_ROOM > RACK > LEVEL` | `SR1-R1-L1` |
| Hospital | `BUILDING > FLOOR > ROOM > CABINET > SHELF` | `B2-F3-R12-C4-S2` |
| Distribution centre | `SITE > WAREHOUSE > AISLE > RACK > LEVEL > BIN` | `JEB-WH2-A7-R3-L2-B4` |
| Provisioner default | `WAREHOUSE > AISLE > SHELF` | `W1-A1-S1` |

Rules:
- Depth is arbitrary; nothing assumes three levels.
- `canHoldStock` marks the level that stores goods. Only those nodes get a barcode and stock
  positions.
- `designator` is the ancestor codes joined by `-`, cached and recomputed on rename or move.
- `materialisedPath` makes a subtree one indexed `LIKE`; the application never recurses.
- Codes are unique among siblings, not globally (two rooms may each have `R1`).
- Deactivate, never delete, anything with history.
- Vocabulary comes from `LocationType.nameEn/nameAr` ("Add {{typeName}}" → "Add Rack").
- Guardrail: `STORE_ROOM`, `RACK`, `LEVEL` and a literal depth of three appear only in seed data
  and tests (checked 2026-10-02).
- **Proven** on 2026-08-05: two differently shaped demo databases, a 4-level
  `Depot > Zone > Rack > Bin` and a 5-level `Base > Warehouse > Aisle > Rack > Bin`, ran with no code
  change (CLAUDE.md §13.2's product acceptance test).

---

## 10. API surface

REST at `/api/v1`, OpenAPI at `/api/v1/docs` (blocked in production), JWT bearer auth, Zod at
every boundary. **66 endpoints**, generated from the controllers by
`scripts/list-endpoint-roles.py`. "Any" means any signed-in user.

| Area | Endpoints (role) |
|---|---|
| Auth | `POST /auth/login` · `/auth/refresh` · `/auth/mfa/verify` · `/auth/mfa/enroll/start` · `/auth/mfa/enroll/confirm` (public, rate-limited) · `POST /auth/logout` · `GET /auth/me` (any) |
| System | `GET /health` · `GET /system/info` (public; demo logins omitted in production) |
| Organisation | `GET /organization` (any) · `PATCH /organization` (ADMIN, audited) |
| Products | `GET /products` (`?search`, `categoryId`, `lowStock`) · `GET /products/:id` · `/:id/stock` · `/resolve/:barcode` · `/import-template` (any) · `POST /products` · `PATCH /:id` · `DELETE /:id` (guarded) · `POST /products/import` (`?dryRun=true`) (ADMIN) |
| Reference data | `GET /product-categories` · `/units-of-measure` · `/location-types` (any) |
| Storage locations | `GET /storage-locations` (tree with rollups) · `/:id` · `/:id/stock` · `/resolve/:barcode` (any) · `POST /storage-locations` · `/bulk-create` (`?preview=true`) · `PATCH /:id` · `DELETE /:id` (subtree, guarded) (ADMIN) |
| Stock movements | `POST /stock-movements` (any; idempotent on `clientId`, atomic, audited) · `GET /stock-movements` (`?type`, `productId`, `locationId`, `userId`, `from`, `to`, `limit` ≤ 5000) |
| Cycle counts | `GET /cycle-counts` · `POST /cycle-counts` · `GET /:id` · `POST /:id/scan` · `POST /:id/close` (`{ apply }`) (any) |
| Replenishment | `GET /recommendations` (any) · `POST /recommendations/run` · `/:id/approve` (`{ approvedQty? }`) · `/:id/reject` (`{ reason }`) (ADMIN) |
| Purchase orders | `GET /purchase-orders` · `GET /:id/pdf` (any) · `POST /purchase-orders/generate` (ADMIN) |
| Suppliers | `GET /suppliers` (any) · `POST` · `PATCH /:id` · `DELETE /:id` (ADMIN) |
| Dashboard | `GET /dashboard/summary` (any) |
| Predictive analytics | `GET /predictive-analytics/summary` · `/forecast/:productId` (any) |
| Barcode labels | `GET /barcode-labels/product/:id` · `/location/:id` · `POST /batch` (any) |
| Reports | `GET /reports/stock-on-hand` · `/stock-movements` · `/replenishment` (`?format=pdf|xlsx`, English only) (any) |
| Audit log | `GET /audit-log` (ADMIN) |
| Users | `GET` · `POST` · `PATCH /:id` · `DELETE /:id` · `POST /:id/end-sessions` · `/:id/reset-mfa` (ADMIN) |
| Assistant | `POST /assistant/query` `{ text, language }` → `{ answer, sources, isDevelopmentModel }` (any; audited as `ASSISTANT_QUERY`) |

**AI service (internal only):** `GET /health` · `POST /assistant/query` ·
`GET /forecasting/products/{product_id}`.

**Specified in CLAUDE.md §7 but not built** (§29): `POST`/`PATCH /location-types`,
`POST /storage-locations/:id/move`, `/storage-locations/import` and `/export`,
`PATCH /products/bulk`, `POST`/`PATCH /product-categories`, `POST /units-of-measure`,
`GET`/`POST /product-attributes`.

---

## 11. Backend modules

24 modules registered in `app.module.ts`. Each lives in `backend/src/modules/<name>/`.

| Module | What it does |
|---|---|
| `authentication` | Login, refresh with rotation and reuse detection, logout, lockout (5 failures → 15 minutes, audited), two-step sign-in (TOTP, off by default), no account enumeration, localised errors |
| `users` | ADMIN-only management; password policy (≥ 12 characters, blocklist); end sessions; reset two-step; last-admin and self guards; sign-out everywhere on deactivate or password reset |
| `organization` | Settings: names, language, timezone (audited) |
| `products` | List and detail, create/edit/delete (guarded), internal barcodes (`INT-#########`), Excel import with template, dry run, row errors and all-or-nothing commit; `computeStatus()` is the one definition of stock status |
| `product-categories`, `reference-data` | Category tree, units, location types (read) |
| `storage-locations` | Tree with item and unit rollups, single and bulk create with preview, rename, deactivate, guarded subtree delete, barcode resolve |
| `stock-movements` | The core: idempotent on `clientId` (checked before and inside the transaction), atomic, audited in the same transaction; never-negative guard, ≥ 10-character adjustment reason, per-type shape checks |
| `cycle-counting` | Sessions; scans snapshot the on-record quantity; closing with `apply` writes one audited `ADJUSTMENT` per variance through the movements path |
| `replenishment` | `reorder-calculator.ts` (pure), `reasoning-generator.ts` (bilingual templates), daily review honouring "not again today after a rejection"; accepts Stage 2 forecasts without changing the interface |
| `purchase-orders` | One PO per supplier per run (`PO-YYYY-####`), PDFKit PDF with the carton mark, emailed via Nodemailer; status SENT once mailed |
| `suppliers` | CRUD with guarded delete |
| `dashboard` | Real aggregates: status counts, 14-day trend, stock by category, pipeline, 30-day movements, recent activity |
| `predictive-analytics` | Days to stockout, usage trend, projected reorder spend (reusing the reorder calculator), forecast proxy to the AI service |
| `reports`, `barcode-labels` | PDF/Excel exports (English); Code128 label PNGs |
| `audit-log` | ADMIN viewer API |
| `assistant` | Proxies to the AI service and audits every question |
| `system`, `health` | Public info and health |

**Cross-cutting:** `security/rate-limiting` (10 requests per 60 s per IP and endpoint on `/auth/*`),
`security/log-hygiene` (Pino JSON, redaction of credentials, emails, IPs and query strings),
`ZodValidationPipe`, `email/email.service.ts` (STARTTLS required unless `SMTP_REQUIRE_TLS=false`),
`documents/pdf-brand-mark.ts`, `database/` (Prisma), `ai-service-client/` (timeouts: 60 s
assistant, 30 s forecast).

---

## 12. Frontend screens

17 routes in `frontend/src/App.tsx`. After sign-in, everyone lands on the Morning briefing.

| Route | Screen | Highlights |
|---|---|---|
| `/login` | Sign in | Organisation name live; two-step steps when enabled; idle-sign-out notice |
| `/briefing` | Morning briefing | "N things need you today": approvals with in-place Approve (ADMIN), products running out within 7 days, open counts, queued scans |
| `/dashboard` | Dashboard | 5 count-up figures, movement trend, stock by category, stock health and pipeline bars, recent activity |
| `/stock` | Scan and move (Record) | Goods in/out/transfer/adjustment; location first, then products; offline outbox; "This session" list |
| `/stock?view=history` | Movements (History) | Real history with filters (user filter ADMIN only), load more by 100 |
| `/cycle-counting` | Cycle counts | Sessions, live variance, close with or without applying |
| `/products`, `/products/:id` | Products | Search, category, low stock, unit cost, barcode find, import, batch labels; detail with positions |
| `/locations` | Storage locations | Tree (keyboard operable), bulk create with preview and label printing, rack view with the scanned shelf lit, big designator strip on scan |
| `/replenishment` | Replenishment | Recommendation cards with bilingual reasoning; approve, amend, reject; run review; generate POs |
| `/purchase-orders` | Purchase orders | Read-only list with status and emailed time, View PDF |
| `/suppliers` | Suppliers | CRUD |
| `/insights` | Insights | Stockout risk, usage trends with sparklines, forecast against actual (honest "building forecast" below the minimum), projected spend by supplier and category |
| `/reports` | Reports | PDF and Excel exports |
| `/audit-log` | Audit log (ADMIN) | Filters, before/after values |
| `/users` | Users (ADMIN) | Roles, sessions ("Signed in on"), End sessions, two-step status and reset |
| `/compliance` | Security and data (ADMIN) | The on-premise promise and all 20 DESC controls, parsed from the evidence matrix at build time |
| `/settings` | Settings (ADMIN) | Organisation names, language, timezone |

### Application shell

- **Navigation rail**: a floating clay slab, 220 px, collapsing to 56 px (always at ≤ 1024 px).
  Groups: Operate, Stock, Purchasing (pending-approval count), Analyse (Assistant opens the
  drawer), Administer. Store keepers do not see Audit log, Users, Security and data, or Settings.
  The active item is a yellow sign that slides between links.
- **Top bar**: the page title as a sign, catalogue search, user, language and theme toggles.
- **Status strip**: connection (follows the browser's online state since 2026-10-05), API
  version, database, **offline queue depth**, organisation code, the On-site badge, Gulf time.
  Never hidden.
- **Assistant**: a yellow tile in the reading-end corner opens a floating clay drawer with
  chat-style turns, source records with readable labels and stock status, a "looking up" state,
  Ask again on errors, and a new-conversation button.
- **Idle timeout**: warning one minute before the 30-minute sign-out.
- Dialogs and the drawer render into `<body>` through a portal, trap focus, close on Escape and
  return focus.

---

## 13. Barcode scanning and offline operation

The scanner is a wireless keyboard-wedge unit: it "types" the code fast and sends Enter.

- `barcode-scanner-listener.hook.ts`: keystrokes under 30 ms apart are a scan; flush on Enter or
  100 ms idle; duplicates within 1.5 s ignored; **no focused field needed**; one barcode box
  holds the scanner at a time.
- Every lookup raises a full-screen sign: yellow **Accepted**, red **Not accepted**, or
  **Already scanned**, each with its own sound and vibration.
- Location first: scan the shelf once, then any number of products.
- Manual entry fallback on every barcode box.
- **Offline**: every movement goes to the IndexedDB outbox first, carries a client UUID, and
  syncs in order on reconnect, at start-up and every 20 s. Failures stay in a review list; nothing
  is dropped silently. The status strip shows "Offline" and the queue depth.

---

## 14. Design system — the Clay edition

Defined once in `shared/design-tokens/design-tokens.css`; components use only tokens.

### How the look evolved

| Date | Edition | Summary |
|---|---|---|
| Phase 0 | Instrument | Deep teal and IBM Plex, hairlines, 4 px corners |
| 2026-08-04 | Graphite | Warm-grey dark theme |
| 2026-09-23 | Pronounced corners | 14 px default radius (client decision) |
| 2026-10-01 | Airfield | Airfield signage: location, direction and mandatory signs; Overpass; split-flap designator; more motion |
| 2026-10-01 | Option A "Direction sign" | Yellow by day, blue-grey night, no black blocks in light mode |
| **2026-10-03** | **Clay** (current) | Moulded clay surfaces, butter-yellow sign tiles on a navy gantry, no square corners |

### Clay principles

- **Raised** surfaces (panels, buttons, the shell slabs): soft drop below, lit edge above, shaded
  edge below. **Pressed in** (fields, tracks, switches, table headers). No hairline boxes; hairlines
  only divide rows.
- **Signs keep their meanings**: location sign = where you are; direction sign (yellow) = go
  ahead; mandatory sign (red) = stop.
- **The one bold element**: the navy gantry holding yellow clay sign tiles that squish into place
  when a location is scanned.

### Colour tokens

| Token | Light | Dark |
|---|---|---|
| `--canvas` | `#D9E1EA` | `#1B2230` |
| `--surface` | `#ECF1F6` | `#253043` |
| `--surface-sunken` | `#DEE5ED` | `#1F2838` |
| `--ink` / `--ink-muted` / `--ink-faint` | `#1C2737` / `#465267` / `#56627A` | `#E7ECF3` / `#B3BDCC` / `#98A3B5` |
| `--primary` (fill) / `--primary-ink` (text) | `#F4C64A` / `#6B4E00` | `#F4C64A` / `#F4C64A` |
| `--ok` / `--warn` / `--critical` | `#1F6848` / `#7A5300` / `#A1312A` | `#86D9B4` / `#F2C26A` / `#F4A49C` |
| `--sign-stop` | `#B3362C` | `#C9443A` |
| `--gantry` | `#2A3A52` | `#121A27` |
| `--brand-*` (logo, fixed) | tile `#F4C64A`, box `#3B4F6E`/`#2A3A52`/`#1F2C40` | same |

Relief tokens: `--clay-raised`, `--clay-raised-sm`, `--clay-pressed`, `--clay-tinted`,
`--clay-gantry`, `--shadow-floating`. Every text/background pair passes WCAG AA (§20).

### Type, geometry, motion

| | |
|---|---|
| Fonts | Figtree (interface), Fredoka (signs, headings, brand), DM Mono (codes), IBM Plex Sans Arabic (Arabic, first family in RTL) — all self-hosted |
| Scale | 11 / 12 / 13 (data default) / 15 / 18 / 22 / 28 px, designator 40 px; tabular figures everywhere |
| Radii | dot 3 · chip 10 · sm 12 · sign 16 · md 18 (default) · panel 24 · lg 28 px. Never a pill on buttons |
| Spacing | 8 px grid: 4 8 12 16 20 24 32 48 64 |
| Motion | 140 ms hover/press · 260 ms entries · 480 ms bars and count-ups · squish on sign changes · split-flap legends · page entry stagger. All off under reduced motion |
| Scrollbars | slim rounded clay thumb, clear track; rail thumb only on hover; content fades under the top bar and status strip |
| Layout | rail 220/56 px · top bar · status strip 36 px (44 on tablets) · content max 1440 px · 12 px gaps between slabs · tablet tap targets ≥ 44 px |

### Signature element — the designator strip

`LocationDesignator` takes an array of segments: 2–4 at full size, 5 at 30 px, 6 or more shows
the first, an ellipsis, then the last three (full path on hover). In RTL the order reverses; each
code stays left-to-right and is never translated. `LocationChip` is the small table version.

---

## 15. Brand and logo

**The mark: the scannable carton** (chosen 2026-10-03 after three rounds of concepts). A navy
carton in three-quarter view, lit from above, with four bold sign-yellow barcode bars on its
shaded side, on a sign-yellow rounded tile. Four bars rather than a realistic code, so it reads
at 16 px.

| Where | File |
|---|---|
| In the app (rail, sign-in) | `frontend/src/design-system/brand-mark/MizanMark.tsx` (CSS clay shadow, flat drawing) |
| Favicon and colour mark | `frontend/public/logo/mizan-mark.svg` |
| Single-colour mark | `frontend/public/logo/mizan-mark-mono.svg` |
| Lockup with "Mizan" and "ميزان" | `frontend/public/logo/mizan-logo.svg` (names are live text with fallbacks) |
| PDFs (purchase orders, reports) | `backend/src/documents/pdf-brand-mark.ts`, vector |
| Colours | `--brand-*` tokens, identical in every theme |

Rejected concepts: moulded scales, level shelf, gantry, meem on the beam (chosen, then withdrawn
by the client), balanced M, located carton, stacked cartons, rack M, dimensional carton, opened
carton, stock layers, pinned carton. The root `brand/` folder holds the same carton files as
`frontend/public/logo/`.

---

## 16. Bilingual — English and Arabic

- react-i18next; strings in `shared/translations/english.json` and `arabic.json`, both complete.
- Switching sets `<html lang dir>` and persists to the profile and local storage.
- CSS logical properties throughout; directional icons mirror, logos and clocks do not; charts
  mirror axis placement (the category chart renders its SVG left-to-right so Arabic labels are not
  cut off).
- Designators, SKUs, barcodes and PO numbers are never translated or mirrored (`<bdi>`,
  `dir="ltr"`). Mixed-language messages take their own direction (`dir="auto"`).
- Western Arabic numerals in both languages; Gregorian dates, DD/MM/YYYY, Gulf time.
- Products carry English and Arabic names, falling back to the other language with a marker.
- PDF and Excel exports are English only (OPEN-QUESTIONS #18).
- `?pseudo=1` lengthens strings by 40 % to catch layout breakage.

---

## 17. The AI — three engines

Only one needs a GPU, which is why procurement works anywhere.

### 1. Replenishment — deterministic, in the backend

```
dailyUsage     = sum(GOODS_OUT, trailing 30 days) / 30
leadTimeDemand = dailyUsage × supplier.leadTimeDays
safetyStock    = dailyUsage × 3
effectiveROP   = max(product.reorderPoint, ceil(leadTimeDemand + safetyStock))
if stock <= effectiveROP:
    suggestedQty = max(maxLevel − stock, dailyUsage × leadTimeDays × 1.5), rounded up to packSize
    reasonCode   = BELOW_REORDER_POINT
```

Reasoning text comes from **templates filled with computed values, never the language model**:
"Stock is 12 units. Average use is 4 units per day and delivery takes 5 days, so stock will run
out in about 3 days. Recommend ordering 48 units." Identical on any model; cannot hallucinate.

### 2. Demand forecasting — AI service

`ai-service/src/demand_forecasting/`: zero-filled daily `GOODS_OUT` series; simple exponential
smoothing (statsmodels) with **at least 30 days of history** or no forecast; seasonal uplift
needs 90 days and flags a recent week ≥ 25 % above baseline. Below the minimum the API says so and
the UI shows "building forecast — N of M days".

### 3. The assistant — needs the GPU

Classify the question → run a real query through the backend → the model phrases the answer from
the returned data only. **The model never produces figures**; the source records ship with the
answer and the panel shows them. Routing: keyword router first (precise, instant), then Ollama
tool-calling with 6 tools and one retry.

### The model choice

| Model | Result on the 8 GB board under real load |
|---|---|
| 14B (specified) | never fit |
| 7B | did not work |
| 3B default | correct, but 100–250 MB free and one CUDA out-of-memory crash |
| 3B q2_K | gibberish |
| 3B q3_K_M | invented a wrong Arabic stock total |
| **1.5B (chosen)** | stable in testing, never invented a number; Arabic terser |

Switching models is one variable, `LANGUAGE_MODEL_PROFILE`; only `model_profiles.py` names a model.

### Arabic quality gate — does not pass

Recorded in `documentation/security-compliance/language-model-validation.md`. Arabic small-talk
once invented product categories, so Arabic general chat now returns a fixed safe message
instead of generating. `arabic_verified` stays false. **Do not present the assistant to the
client** (CLAUDE.md §2.2); the demo script and the video leave it out.

### Current state on this board (2026-10-05)

The AI service had stopped (it is not a system service) and was restarted by hand. Ollama then
**could not load even the 1.5B model**: the GPU can use only genuinely free memory (about
0.8 GB), while the desktop browser, Ubuntu's update tools and 2.4 GB of file cache hold the rest.
Fix: `sudo sh -c 'sync; echo 3 > /proc/sys/vm/drop_caches'` and close desktop apps; on the
production server the stack runs without a desktop. Replenishment and forecasting do not depend
on this.

---

## 18. Business rules

| # | Rule | Enforced in |
|---|---|---|
| 1 | Stock never goes negative | `stock-movements.service.ts`, inside the transaction |
| 2 | Adjustments need a reason of ≥ 10 characters | `stock-movements.service.ts` |
| 3 | Transfers are atomic | one `$transaction` |
| 4 | Cycle counts never change stock directly; applying writes audited adjustments | `cycle-counting.service.ts` |
| 5 | Only ADMIN approves recommendations and generates POs | `@Roles(Role.ADMIN)` |
| 6 | A rejected recommendation is not regenerated the same day | `replenishment.service.ts` |
| 7 | One purchase order per supplier per run | `purchase-orders.service.ts` |
| 8 | Every state change writes its audit record in the same transaction | every service (sign-in and supplier gaps fixed 2026-10-02) |
| 9 | Pack conversion is display-only; base units are stored | schema and UI |

**Safe delete** (no foreign keys, so guarded in code): users (not self, not the last admin, no
history), products (no stock, movements, recommendations or count lines), locations (whole empty
subtree with no history; otherwise "transfer first" or "deactivate instead"), suppliers (not
referenced). Every delete is audited.

---

## 19. Security and DESC compliance

Legend: ✔ verified with evidence · ☑ implemented (production-only items checked statically).

| # | Control | Status | Implementation |
|---|---|---|---|
| 1 | Encryption in transit | ☑ | nginx TLS 1.2/1.3, HSTS, HTTP → HTTPS (`nginx.production.conf`) |
| 2 | Encryption at rest | ☑ | data directory on LUKS (host check), AES-256 backups |
| 3 | Password storage | ✔ | argon2id, ≥ 12 characters, blocklist |
| 4 | Session management | ✔ | 15 min access, 7 day refresh, rotation, reuse detection, revocation; sessions in PostgreSQL, not Redis (#20) |
| 5 | Account lockout | ☑ | 5 failures → 15 minutes, audited |
| 6 | Idle timeout | ✔ | 30 minutes, shared across tabs, warning, audited sign-out |
| 7 | Multi-factor | ✔ | TOTP built and verified, `MFA_ENABLED=false` until certification |
| 8 | Access control | ☑ | `JwtAuthGuard` + `RolesGuard` at controllers; 66 endpoints mapped |
| 9 | Audit logging | ☑ | same transaction as the change; spec in `audit-logging-specification.md` |
| 10 | Log immutability | ☑ | 4 PostgreSQL rules; production role has no UPDATE/DELETE on those tables |
| 11 | Network segmentation | ☑ | internal Docker networks; AI and Ollama have no internet route |
| 12 | Rate limiting | ✔ | 10 per 60 s per IP and endpoint on `/auth/*`, bilingual 429 |
| 13 | Secure headers | ✔ | Helmet `default-src 'none'` on the API; strict CSP for the app; 0 violations on 16 screens |
| 14 | Secrets management | ☑ | `.env*` git-ignored; only templates committed |
| 15 | Log hygiene | ✔ | Pino JSON; credentials, emails, IPs and query strings redacted |
| 16 | Dependency scanning | ☑ | `run-dependency-scan.sh`, dated reports; 0 high/critical runtime findings (2026-10-01) |
| 17 | Backup and recovery | ☑ | encrypted daily backups, guarded restore, tested restore record 2026-10-01 |
| 18 | Data residency | ☑ | all on-premise; SMTP the only outbound |
| 19 | Least privilege | ☑ | `mizan_owner` (migrations), `mizan_app` (API), `mizan_backup` (read-only) |
| 20 | Input validation | ☑ | Zod pipe; Prisma parameterised; shared data-contracts package not extracted |

**Evidence** in `documentation/security-compliance/`: `control-implementation-matrix.md`,
`data-flow-diagram.md`, `encryption-configuration.md`, `access-control-model.md`,
`audit-logging-specification.md`, `backup-and-recovery-procedure.md`,
`restore-test-records/2026-10-01-restore-test.md`, `dependency-scan-reports/2026-10-01/`,
`accessibility-conformance-report.md`, `language-model-validation.md`,
`evidence-control-10-append-only-rules.sql`. The in-app **Security and data** page reads the matrix
at build time, so it can never claim more than the evidence.

**Before switching two-step sign-in on**: set `MFA_ENCRYPTION_KEY` (`openssl rand -base64 32`),
then `MFA_ENABLED=true`. Everyone enrols at their next sign-in; the AI service account is the only
exemption, and only from this server's network.

**Development caveats**: controls 1, 2 and 17 are not production-grade on the board (no TLS,
unencrypted disk, local backups). The backup key must be copied off the board.

---

## 20. Accessibility

- WCAG 2.1 AA contrast for every token pair in both themes, regenerated from the tokens
  (`accessibility-conformance-report.md`).
- axe: 0 violations on every screen and every pop-up (including both two-step screens), in
  English light and Arabic dark.
- Keyboard-only: sign in, navigate, operate the storage tree, open and close dialogs; focus is
  visible everywhere (an outline is required; shadows do not count).
- Tablets at 768 and 1024 px: no sideways scrolling, rail collapsed, all controls ≥ 44 px.
- Stock status is never colour alone (square plus label); motion respects reduced motion; screen
  readers get final values, not animation frames.

---

## 21. Testing

| Layer | Tool | Count | State |
|---|---|---:|---|
| Backend unit | Jest | 37 tests, 6 suites | passing |
| Frontend unit | Vitest | 15 tests, 4 files | passing |
| End to end | Playwright | 17 (+1 opt-in that creates a PO) | passing |
| Accessibility | axe in Playwright | included above | 0 violations |
| AI service | pytest | 44 | passing |
| Backend integration (Testcontainers) | — | — | not built |

End-to-end specs: stock movement by scanning; offline scan then sync (asserts "Offline" and
"Synced"); preferences persist (Arabic, dark); axe on every screen; axe on every overlay and
two-step screen; keyboard and focus; tablets at 768 and 1024; approval to purchase order (opt-in,
`E2E_ALLOW_PURCHASE_ORDERS=1`).

```bash
npm --prefix backend test                    # backend unit
cd frontend && npx vitest run                # frontend unit
cd frontend && npx playwright test           # end to end (needs the app running)
cd ai-service && python3 -m pytest -q        # AI service
npx tsc --noEmit -p frontend/tsconfig.json   # type check (3 old vite.config.ts errors: no @types/node)
```

Screenshots on the board: snap Chromium cannot read `/tmp`, so serve files over HTTP; `npm install`
prunes `playwright-core`, so reinstall it with `npm install --no-save playwright-core`.

---

## 22. The demo dataset

Built by `backend/prisma/seed.ts`; rebuilt cleanly by `scripts/reset-demo-database.sh --yes`
(encrypted backup first, refuses production, about 10 s).

| | |
|---|---|
| Organisation | 1, Asia/Dubai, AED; code from `ORGANIZATION_CODE` (now `GPT`); seeded as "Demo Organization", renamed through the API to **Grow Plus Technologies / جرو بلس تكنولوجيز** |
| Locations | `STORE_ROOM > RACK > LEVEL`: 3 rooms × 6 racks × 5 levels = 90 shelves, 111 nodes |
| Catalogue | 9 categories, 7 units, 7 suppliers (lead times 2–7 days), 75 products, each with an AED unit cost |
| Stock | 83 positions |
| History | 150 days of movements: weekday pattern (UAE Monday–Friday week), noise, and an accelerating trend on 5 SKUs that are genuinely near stockout; restocks twice per product |
| Cycle counts | 5 sessions (4 closed, 1 open), 22 lines, 8 real variances |
| Recommendations | 8, produced by the real engine |
| Users | admin, store keeper, AI service account |

**Demo logins (demo only; the rail's reveal disappears in production):**

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@example.com` | `Admin@Mizan2026` |
| STORE_KEEPER | `storekeeper@example.com` | `Store@Mizan2026` |
| AI service | `ai-service@example.com` | from `SERVICE_ACCOUNT_PASSWORD` |

**Multi-entity provisioner**: `scripts/create-entity.ps1` + `backend/prisma/entity-seed.ts` create a
separate database per organisation with a default hierarchy, users and optional sample data.

---

## 23. Running the system

```bash
# Backend (terminal 1)
cd /mnt/nvme/inventory/backend
npm install && npm run build
node --enable-source-maps dist/src/main        # → http://localhost:3000/api/v1

# Frontend (terminal 2)
cd /mnt/nvme/inventory/frontend
npm install && npm run dev                      # → http://localhost:5173

# AI service (terminal 3): assistant, Insights forecast, 07:00 review
cd /mnt/nvme/inventory/ai-service
uvicorn src.main:app --host 127.0.0.1 --port 8000   # reads .env.development from this folder

# PostgreSQL and Ollama run as system services.
```

`backend/.env` must set `AI_SERVICE_URL=http://localhost:8000` when running natively (the shared
default is the Docker hostname). After editing `shared/`, Vite reloads by itself (watcher added
2026-10-01).

### Operations scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `backup-database.sh` | encrypted backup (AES-256, checksum, retention) |
| `backup-scheduler.sh` | daily backup at `BACKUP_TIME` |
| `restore-database.sh` | restore with checksum, refuses to overwrite a live database |
| `verify-backup-restore.sh` | tested restore into a scratch database |
| `reset-demo-database.sh` | clean demo rebuild |
| `run-dependency-scan.sh` | npm audit and pip-audit, dated reports |
| `check-production-host.sh` | pre-install checks (encrypted disk, ports, …) |
| `list-endpoint-roles.py` | endpoint and role table from the controllers |
| `create-entity.ps1` | new organisation database |

---

## 24. Production deployment

Guide: `documentation/administrator-guide/production-deployment.md`.

**Needs**: a Linux server with Docker Compose v2 and the NVIDIA Container Toolkit; a LUKS-encrypted
data disk; the organisation's TLS certificate; the SMTP relay address; internet access during
installation only (images and the model).

**Enforced by configuration**: TLS and HSTS; encrypted volumes; internal networks; strict
headers; daily backups; least-privilege roles; non-root, read-only containers with all
capabilities dropped. Firewall: inbound 443 (80 redirects); outbound only to the SMTP relay.

**Routine**: weekly restore test; dependency scan before each release; updates by pull, build,
`up -d` (migrations run automatically).

**Not yet verified on hardware**: Docker needs administrator rights on the board, so the stack was
checked statically (compose validates, scripts pass syntax checks, host check and privilege script
exercised). The first install is the first full run; record it in `security-compliance/`.

Optional: `hosting/` describes public demo hosting (Firebase), separate from the product, for
demo data only.

---

## 25. Environment variables

Template: `infrastructure/environment-templates/.env.example`. Real `.env` files are git-ignored.

| Group | Variables |
|---|---|
| App | `NODE_ENV`, `API_PORT`, `APP_NAME`, `ORGANIZATION_CODE`, `DEFAULT_LANGUAGE`, `TZ` |
| Database | `DATABASE_URL` |
| Sessions and sign-in | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_IDLE_TIMEOUT_MINUTES` (30), `ACCOUNT_LOCKOUT_ATTEMPTS` (5), `AUTH_RATE_LIMIT_MAX_REQUESTS` (10), `AUTH_RATE_LIMIT_WINDOW_SECONDS` (60), `TRUST_PROXY` |
| Two-step | `MFA_ENABLED` (false), `MFA_ENCRYPTION_KEY`, `MFA_ISSUER`, `MFA_EXEMPT_ACCOUNTS`, `MFA_EXEMPT_NETWORKS` |
| Logging | `LOG_LEVEL` |
| Backups | `BACKUP_DIRECTORY`, `BACKUP_ENCRYPTION_KEY_FILE`, `BACKUP_RETENTION_DAYS` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (plus `SMTP_REQUIRE_TLS`, default true, not yet in the template) |
| AI | `AI_SERVICE_URL`, `OLLAMA_URL`, `LANGUAGE_MODEL_PROFILE`, `SERVICE_ACCOUNT_EMAIL`, `SERVICE_ACCOUNT_PASSWORD`, `REPLENISHMENT_RUN_TIME` (07:00) |

Current board values worth knowing: `ORGANIZATION_CODE=GPT`; `LANGUAGE_MODEL_PROFILE=qwen-production`;
SMTP blank (purchase orders stay DRAFT unless a relay is configured).

---

## 26. Version control

- **Remote**: `https://github.com/ismayil-gpt/inventory-management-procductize`, default branch `main`.
- **Merged pull requests**: #1 airfield design, product features, DESC hardening, production
  packaging · #2 clay edition, carton logo, clay scrollbars · #3 assistant redesign, portal
  dialogs, alignment fixes.
- **Not pushed**: branch `fix/status-strip-offline-and-pdf-brand` (`854ed51` status strip offline,
  carton mark on PDFs, seed organisation code; `4d0ee36` progress notes) and this document.
- **Local only, by decision**: `backup-github-main`, a single unrelated commit `66dea6f`
  (2026-08-27, "first customer DCAA") containing files absent here (EDGE and ENOC seed variants, a
  DCAA data dictionary). It is not an ancestor of `main`; kept untouched (decided 2026-10-02).
- **Conventions**: Conventional Commits; branches `feature/…` and `fix/…`; `.env*`, keys, builds and
  caches ignored.

---

## 27. Client-facing material

| Item | Where |
|---|---|
| Demo script (25 minutes, what not to show) | `documentation/client-acceptance/demo-script.md` |
| Acceptance checklist (27 checks with sign-off) | `documentation/client-acceptance/acceptance-checklist.md` |
| Store keeper guide | `documentation/store-keeper-guide/store-keeper-guide.md` |
| Administrator guide | `documentation/administrator-guide/administrator-guide.md` |
| Production deployment guide | `documentation/administrator-guide/production-deployment.md` |
| **Demo video** | `/home/jetson/Videos/mizan-demo/mizan-demo.mp4` (+ `mizan-demo.en.srt`) |
| Design demos and logo sheets | private claude.ai pages: airfield demo `9A4zBRtVMukJwqMi3Aw1Tx`, clay demo `7UgyNyjUCBJ48sXRYAvUyV`, logo rounds `Vd7UTwdRMPiivb9Sn52DFV`, `YPVkUTEES2d14TQWutG2eU`, `FeThJp2bPS3iYbrorAeCRx` |

### The demo video (2026-10-05)

2:35, 1920×1080, 30 fps, H.264 and AAC, 15 MB. English captions drawn into the picture plus an
English subtitle file; original music composed in code (calm, 92 BPM, C major). Storyline:
opening logo → "store rooms run on paper and memory" → sign in and morning briefing → scanning a
shelf and products → offline queue and sync → storage locations and rack view → a recommendation's
reasoning and approval → purchase order generated and emailed (to a local mail catcher; nothing
left the board) → Arabic and dark mode → security page and audit log → end card (Grow Plus
Technologies, gptechnologies.ae, +971 4 259 9011). Everything shown is the real app on fresh demo
data. The assistant is left out (§17).

Production method: a script drives the real app at a 1440-wide layout scaled to 1080p; frames come
from Chromium's screencast; title cards and caption pills are HTML in the clay style; ffmpeg joins
everything with cross-fades. **The tooling lives in the session scratchpad under `/tmp`, which does
not survive a reboot** (§29).

---

## 28. Open questions

Full text in [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md).

| # | Question | Current position |
|---|---|---|
| 1 | Exact rack and level counts | seeded per spec; each customer configures |
| 2 | Is "Mizan" the customer-facing brand? | Mizan is the product; each organisation is named in Settings |
| 3 | Database naming | `mizan` / `mizan_inventory` |
| 4 | SMTP relay and credentials | wired, blank until each deployment's IT provides them |
| 5 | Who receives the daily notification, and how | in-app to ADMIN (morning briefing) |
| 6 | Prisma schema location | `backend/prisma/` (spec path broke module resolution) |
| 7 | Where the reorder engine lives | backend |
| 8 | Production model | `qwen2.5:1.5b` (user confirmed) |
| 9 | FAISS and sentence-transformers | not used; `difflib` |
| 10 | Assistant generality | tool-calling as a second tier |
| 11 | Arabic general chat invented categories | fixed safe message in Arabic |
| 12 | "Which product is critical" failed | keyword router extended |
| 13 | Predictive Analytics Dashboard | ✅ built 2026-09-23 |
| 14 | Orphaned movements after re-seed | ✅ resolved by the reset script |
| 15 | Insights visible to store keepers? | visible to both, like the Dashboard |
| 16 | Movement history screen | ✅ built 2026-09-23 |
| 17 | Arabic voice questions | not built: browser speech recognition sends audio to the cloud |
| 18 | Arabic purchase-order PDFs | not built: out of MVP scope |
| 19 | Switching between two building layouts live | not built: needs multi-tenancy |
| 20 | Redis denylist for sessions | sessions in PostgreSQL instead |
| 21 | AI service using a person's admin account | dedicated `ai-service@example.com`; keeps ADMIN for now |
| 22 | Node 22 / NestJS 12 | with production packaging; NestJS 11.2.7 meanwhile |
| 23 | Redis, BullMQ, MinIO | removed from development and production |
| 24 | Audit retention period | **open**: everything is kept until the organisation sets a period |

---

## 29. Known gaps

**Against the specification**
- **Structure administration** (CLAUDE.md §5A.3–§5A.4): there are no screens or write endpoints for
  location types, product categories, units of measure or custom attributes, and none for moving a
  location subtree, importing or exporting the structure, or bulk-editing products (§10). These are
  set by the seed, the provisioner or the database today. Location *nodes* (create, bulk create,
  rename, deactivate, delete) and products are fully administrable.
- The Scan and move page shows a scanned shelf as a small chip row; §9.6 asks for the full
  designator strip wherever a location is scanned (the strip appears on Storage locations).
- No shared `data-contracts` package of Zod schemas (DESC #20 notes this).
- No backend integration tests (Testcontainers).

**Environment**
- The assistant cannot load its model on this board until memory is freed (§17); the AI service
  is not a system service and stops on reboot.
- The Arabic language-model gate does not pass.
- Production stack never run on hardware; backup key not yet copied off the board.
- Audit retention period undecided (#24).

**Repository housekeeping**
- The demo-video tooling is outside the repository, in `/tmp`.
- Cleared 2026-10-13: the stray `BidGate-Brochure.pdf` removed (it stays in history from
  `6fcace1`), `brand/` refreshed to the carton logo, `SMTP_REQUIRE_TLS` added to `.env.example`,
  `vite.config.ts` type errors fixed (`@types/node` and a separate `tsconfig.node.json`).

**Deliberately not built** (CLAUDE.md §5A.6, §13.6): multi-tenant isolation, self-service
onboarding, white-labelling beyond name and logo, licensing, cross-customer reporting, RFID,
expiry and batch tracking, ERP integration, native mobile apps, Arabic PDF/Excel.

---

## 30. Roadmap and next steps

| Phase | Status |
|---|---|
| 0 Foundation | ✅ |
| 1 Inventory core | ◐ everything except the structure-administration screens (§29) |
| 2 AI Store Manager | ✅ |
| 3 Dashboard, reporting, hardening | ✅ including DESC evidence and accessibility |
| Stage 2 (forecasting, assistant, production model) | ◐ built; Arabic gate fails; production not installed |
| Product phase (multi-tenancy, licensing, …) | ⬜ by design |

**Suggested order**
1. Run client acceptance with the demo script, checklist and video.
2. Copy the backup key off the board; decide the audit retention period (#24).
3. First production install on the target server; record the result as DESC evidence; move to
   Node 22 and NestJS 12 there.
4. Re-run the Arabic language-model gate on the production GPU before showing the assistant.
5. Build the structure-administration screens and endpoints (§29) to finish Phase 1.
6. Bring the demo-video tooling into the repository so the video can be re-shot after changes.

---

## 31. Key decisions and why

| Decision | Reasoning |
|---|---|
| Configuration over code | Storage shape, catalogue, vocabulary and branding are data; that makes Mizan a product. |
| Deterministic over generative | The reorder engine is auditable maths, identical on any model; the language model only phrases real data. |
| Auditability over convenience | Audit and movements are append-only at the database; deletion is guarded; deactivation is the default. |
| In-app JWT, not Keycloak | Five users, on-premise; every DESC control is satisfiable in the app; two-step built in. |
| Sessions in PostgreSQL, not Redis | One board, no Redis; revocation works the same (#20). |
| Reorder engine in the backend | Works and verifies with no GPU (#7). |
| A smaller model, chosen on reliability | Larger models did not fit or crashed; heavier quantisation invented numbers (#8). |
| Arabic general chat skips the model | Prompting did not stop fabrication; a safe fixed message was accepted (#11). |
| Keyword routing before tool-calling | Tool-calling first regressed cases the router handled exactly (#10). |
| On-premise is the product | Cloud hosting exists only for demos, with demo data. |
| Clay edition, carton logo | Client decisions of 2026-10-03, after demos; sign meanings kept. |
| Truthful demo material | The video uses the real app and real data; email went to a local catcher rather than faking "Sent"; the assistant is left out until the gate passes. |
| Deviations are flagged | Every spec deviation is in OPEN-QUESTIONS with its reasoning. |
| Verify in the browser, both languages, both themes | RTL, clipping, focus and role differences only show there; most real bugs were found this way. |

---

## 32. Project timeline

| Date | Milestone |
|---|---|
| 2026-07-24 | Phase 0: structure, schema, tokens, shell |
| 2026-07-30 – 31 | PostgreSQL; seed and authentication; Phase 1 browse, movements and offline outbox; admin CRUD, Excel import, labels |
| 2026-08-01 | Phase 2 AI Store Manager; Phase 3 reports, audit log, users, cycle counts |
| 2026-08-03 – 05 | UX passes, Graphite dark theme, safe delete, productisation (provisioner, white-label) |
| 2026-09-02 | Stage 2 on the Jetson: assistant and demand forecasting; model choice |
| 2026-09-15 | Repository under git, pushed to GitHub |
| 2026-09-22 – 23 | Dashboard redesign; pronounced corners; unit cost; Insights; widened dataset; movement history |
| 2026-09-25 | Visual and health audit (86 screenshots) |
| 2026-10-01 | Airfield design and logo; navigation; palette A; briefing, rack view, scanner and scan signals, Security page; DESC 4, 6, 7, 12, 13, 15, 16, 17; NestJS 11, React Router 7; production packaging |
| 2026-10-02 | DESC evidence complete; user guides; accessibility finished; acceptance pack |
| 2026-10-03 | Clay edition; scannable-carton logo; clay scrollbars; PR #2 |
| 2026-10-05 | Assistant redesign, portal dialogs, alignment check (PR #3); demo video; status-strip and PDF fixes |
| 2026-10-12 | This reference rewritten |

---

## 33. Glossary

| Term | Meaning |
|---|---|
| **Designator** | A location's full code, ancestor codes joined by `-` (e.g. `SR1-R1-L1`); never translated or mirrored |
| **Materialised path** | `/rootId/childId/leafId` on every node; subtree queries are one indexed `LIKE` |
| **`canHoldStock`** | The location type that stores goods; only its nodes get barcodes and stock |
| **Gantry** | The navy panel that holds the yellow location sign tiles |
| **Effective ROP** | `max(reorderPoint, ceil(leadTimeDemand + safetyStock))`, the threshold the engine compares against |
| **Outbox** | The IndexedDB queue every movement enters before syncing |
| **`clientId`** | Device-generated UUID that makes a movement idempotent |
| **Append-only** | `AuditLog` and `StockMovement` reject UPDATE and DELETE at the database (DESC #10) |
| **Clay relief** | The raised/pressed shadow tokens that define the current look |
| **Scannable carton** | The Mizan logo |
| **DESC** | Dubai Electronic Security Center; its 20 technical controls (§19) |
| **Morning briefing** | The landing page listing what needs attention today |
| **Pseudo mode** | `?pseudo=1`, strings 40 % longer to catch layout breakage |

---

*Rewritten 2026-10-12 from the live repository, database and services. Dated detail:
[`PROGRESS.md`](PROGRESS.md). Binding specification: [`CLAUDE.md`](CLAUDE.md).*
