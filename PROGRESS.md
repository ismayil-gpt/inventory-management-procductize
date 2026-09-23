# PROGRESS — Mizan Inventory System

> Updated at the end of every working session. Ref: `CLAUDE.md` §0, §17.
> Plain-language companion for non-engineers: [`THINGS-TO-DO.md`](THINGS-TO-DO.md).

## Current phase
**Phases 0–3 (MVP scope) functionally complete**, plus productization work (white-labelling,
multi-entity provisioner, safe delete, Graphite dark theme). **Stage 2 AI (§13.5) is now
functionally built and running natively on the Jetson**: the conversational assistant (§8.4)
and demand forecasting (§8.2 Stage 2) — see 2026-09-02 below. English assistant quality is
solid; Arabic does not yet pass the §2.2 gate (documented, badged, not swept under the rug).
Still deferred: production Docker/nginx/TLS/backups packaging (not attempted this session —
everything below runs natively, matching how backend/frontend already run on this box).

## Session log

### 2026-07-24 — Phase 0 kickoff
Established the project foundation and Mizan branding.

**Added**
- Repository directory structure per spec §3.
- Branding: `Mizan` name + balance-scale logo (`brand/`, mirrored to `frontend/public/logo/`).
  - `mizan-mark.svg`, `mizan-logo.svg` (wordmark lockup), `mizan-mark-mono.svg`.
- `shared/design-tokens/design-tokens.css` — full §9 token set, light + dark, incl. `prefers-color-scheme` fallback.
- `shared/translations/english.json` + `arabic.json` — scaffold with generic (config-driven) location strings.
- `database/schema/schema.prisma` — full §5 model incl. `Organization`, `LocationType`, `LocationNode` tree.
- `database/migrations/0001_append_only_rules.sql` — DESC #10 append-only enforcement.
- `docker-compose.development.yml` — dev stack; only nginx published, rest internal (DESC #11).
- `infrastructure/environment-templates/.env.example` — §16 template.
- `documentation/security-compliance/control-implementation-matrix.md` — evidence tracker started.
- `THINGS-TO-DO.md`, `PROGRESS.md`, `OPEN-QUESTIONS.md`, `README.md`.

**Not yet started (remainder of Phase 0)**
- `docker-compose.production.yml`; nginx conf + dev TLS cert; per-service Dockerfiles.
- Backend (NestJS) skeleton + `/api/v1/health`.
- Frontend (React/Vite) skeleton + tokens wired + self-hosted IBM Plex fonts.
- AI service (FastAPI) skeleton + `/health`.
- Prisma migration generation + seed script (demo org, 60 nodes, 50 products).
- JWT auth + role guards; login flow.
- Application shell (rail, top bar, status strip); theme + language switching persisted.
- Freeze API contract (§7).

### 2026-07-24 — Runnable frontend + backend (native, no Docker)
Built and verified a working vertical slice so the frontend↔backend link could be checked
before the GPU move (per user request).

**Backend (`backend/`, NestJS 10)**
- `main.ts` bootstrap: Helmet (DESC #13), CORS, global `/api/v1` prefix, Swagger at `/api/v1/docs`.
- `PrismaService` with graceful degradation — boots without PostgreSQL (health reports `database: disconnected`).
- `HealthModule` (`/health`) and `SystemModule` (`/system/info`).
- Runs with `npm run start:dev` → listening on `http://localhost:3000/api/v1`. **Verified.**
- Note: removed class-validator `ValidationPipe` (stack uses Zod/nestjs-zod per §4) — added with first DTOs.

**Frontend (`frontend/`, React 18 + Vite 5)**
- Tailwind with default palette disabled, mapped to shared design tokens; tokens + translations imported from `/shared` via `@shared` alias.
- App shell: `NavigationRail`, `TopBar`, `StatusStrip` (polls `/health` live), `ApplicationShell`.
- `LocationDesignator` signature component (depth-agnostic). `LoginPage` (cosmetic), `DashboardPage` (live backend data), `PlaceholderPage`.
- i18n (react-i18next) EN/AR; `preferences.store` (Zustand) for theme + language applied to `<html>`.
- Runs with `npm run dev` → `http://localhost:5173`. **Verified: dashboard shows live API data; EN↔AR RTL and light↔dark switching work and persist.**

**Docs added:** `HOW-TO-RUN.md`, `documentation/gpu-readiness-and-upgrades.md`, `.claude/launch.json`.

### 2026-07-30 — PostgreSQL connected
Wired the backend to a real database. **Verified end to end** (dashboard shows `Database: connected`).

- Discovered **PostgreSQL 18** already installed + running as a Windows service on `:5432` (no Docker; that stays for the GPU server).
- Fixed the Prisma schema: enums rewritten one value per line; added explicit generator `output` into `backend/node_modules/.prisma/client` (schema lives in `database/schema`).
- Created a dedicated least-privilege app role **`mizan`** + database **`mizan_inventory`** (owned by `mizan`). App connects as `mizan`, never as the `postgres` superuser (DESC #19 direction).
- `prisma migrate dev --name init` → created all 14 domain tables + migration history (`database/schema/migrations/20260730110858_init/`).
- Applied `0001_append_only_rules.sql` → 4 append-only rules live on `AuditLog` + `StockMovement` (DESC #10, verified via `pg_rules`).
- `backend/.env` `DATABASE_URL` points at the `mizan` role (git-ignored). Setup documented in `database/LOCAL-DATABASE-SETUP.md`.

### 2026-07-31 — Seed data + authentication
Seeded the demo dataset and built real authentication end to end. **All verified.**

**Prisma layout fix (structural)**
- Relocated Prisma to the standard location: `backend/prisma/` (schema, migrations, seed).
  A top-level `database/schema` schema caused a monorepo resolution bug where Prisma kept
  auto-installing a stray client at the repo root. `database/schema/README.md` now points to
  the new location. Recorded in `OPEN-QUESTIONS.md` (#6).

**Seed (`backend/prisma/seed.ts`, from `files/`)**
- Idempotent (wipes demo-owned tables first; never touches append-only tables). Real argon2id
  password hashes via `@node-rs/argon2`.
- Loaded: 1 org, 3 location types, 74 nodes (60 shelves), 7 categories, 7 units, 5 suppliers,
  50 products, 58 stock positions, 2 users. Run with `npm run db:seed`.

**Authentication (backend)** — `@nestjs/jwt` + passport-jwt + `@node-rs/argon2`
- `POST /auth/login` (argon2id verify), `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
- Account lockout (5 attempts → 15 min, DESC #5), audit logging of every auth event (DESC #9),
  no account enumeration, localised error envelope.
- `JwtAuthGuard`, `RolesGuard` + `@Roles()` (DESC #8), `ZodValidationPipe` (DESC #20).
- Protected `GET /dashboard/summary` (live counts) and ADMIN-only `GET /users`.
- Verified: admin login, `/me`, dashboard summary, `/users` as admin; store keeper → 403 on
  `/users`; wrong password → 401; no token → 401; audit rows written.

**Authentication (frontend)**
- `auth.store` (Zustand, localStorage), `authFetch` with refresh-and-retry, `RequireAuth` route
  guard, real `LoginPage` (error + lockout handling), top-bar user chip + logout, dashboard
  reads live `/dashboard/summary`.
- Verified in-browser: unauth → /login; login → dashboard shows live data (50 products, 2533
  units); session persists across reload; logout clears session; zero console errors.

**Demo logins** (min-12-char passwords): `admin@example.com / Admin@Mizan2026` (ADMIN),
`storekeeper@example.com / Store@Mizan2026` (STORE_KEEPER).

### 2026-07-31 — Phase 1: products & locations (browse) + barcode input
Built the first inventory-core screens end to end. **All verified in the browser.**

**Backend (read endpoints, JWT-protected)**
- `products`: `GET /products` (search / categoryId / lowStock), `GET /products/:id` (detail +
  stock positions), `GET /products/:id/stock`, `GET /products/resolve/:barcode`. Each product is
  enriched with category/unit/supplier names, total stock, and a computed status
  (`IN_STOCK|LOW|CRITICAL|OUT`, §9.8 thresholds).
- `product-categories`: `GET /product-categories`.
- `storage-locations`: `GET /storage-locations` (full tree with item/unit rollups from
  stock-holding descendants), `GET /storage-locations/:id`, `/:id/stock?includeDescendants`,
  `GET /storage-locations/resolve/:barcode`.
- Fixed a `TS4053` (exported `TreeNode`) and freed a stuck port 3000 during the build.

**Frontend**
- Design system: `StockStatusIndicator` (square + label, §9.8), `LocationChip` (mono designator,
  last-two-segments + tooltip, §9.6).
- **`BarcodeInput`** (`features/barcode-scanning/`) — **two modes**: *Manual entry* (works now)
  and *Scan* (deliberately stubbed: "Scanner not connected … device coming soon" until the
  wireless HID unit is bought). Reused on both products and locations.
- `ProductsPage` (search + category filter + low-stock toggle + barcode find + table),
  `ProductDetailPage` (info + "where it is stored" positions), `LocationsPage` (expandable tree
  with rollups + barcode-resolve → designator strip + shelf stock).
- Routes wired (`/products`, `/products/:id`, `/locations`); translations added (EN + AR).

**Verified:** products list (50, live), search/filter, manual barcode → product detail; location
tree rollups (SR1 25·1305, SR2 30·1228), manual barcode → designator strip + shelf stock; Scan
stub message; full **Arabic/RTL + dark** render; zero console errors.

### 2026-07-31 — Stock movements + offline outbox
The operational heart. **Verified end to end in the browser, including a full offline round-trip.**

**Backend** — `stock-movements` module
- `POST /stock-movements` — **idempotent on clientId**, atomic (`$transaction`), audited in the
  same transaction (`STOCK_*` rows, DESC #9), with a hard **negative-stock guard** (§12 r1).
  Types: GOODS_IN, GOODS_OUT, TRANSFER (atomic dec+inc), ADJUSTMENT (signed delta, reason ≥10 chars, §12 r2).
- `GET /stock-movements` — filters (type/product/location/user/date), enriched with names + designators.
- Verified via Python: in→10, out→7, transfer→A2/B5, adjust→10; `STOCK_NEGATIVE` + `ADJUSTMENT_REASON_REQUIRED`
  rejects; idempotent retry does not double-apply.
- Fixed a real bug: method-level `@UsePipes(Zod)` also validated `@CurrentUser` → moved the pipe to the `@Body` param.

**Frontend**
- **Offline outbox** (`offline-queue/outbox.store.ts`, Dexie/IndexedDB + Zustand): every movement is
  written to IndexedDB first, then synced; retries on startup, `online` event, and a 20s interval;
  per-item status (pending/synced/error). Queue depth shown live in the **status strip**.
- `StockMovementsPage` — location-first flow: pick type → scan/type location(s) (designator persists) →
  scan/type products against it → quantity (+ reason for adjustment, + delta preview) → Record. Session
  activity list from the outbox. Uses the two-mode `BarcodeInput`.
- **Verified:** Goods-In +15 → Synced, Queue 0, DB=15; then simulated offline → +5 stays **Queued**
  (DB unchanged, not lost) → reconnect → auto-syncs → Queue 0, DB=20. Zero console errors.

> Note: test movements changed PRD-0001's stock. `npm run db:seed` resets the demo data.

### 2026-07-31 — Admin CRUD, Excel import, barcode labels (task 1)
Completed the admin capabilities. **Backend verified via Python; key UI flows verified in-browser.**

**Backend**
- Products: `POST /products` (ADMIN, auto internal barcode `INT-#########` when none given),
  `PATCH /products/:id`, both audited in a transaction. SKU/barcode conflict + level guards.
- Excel: `GET /products/import-template` (ExcelJS), `POST /products/import?dryRun=` — row-by-row
  validation; **never a partial import** (imports only when every row is valid, §5A.4).
- Locations: `POST /storage-locations` (add node), `POST /storage-locations/bulk-create?preview=`
  (§5A generator — cartesian subtree, preview without writing), `PATCH /storage-locations/:id`
  (rename/deactivate). Auto `LOC-…` barcodes for stock-holding types. Audited.
- Barcode labels: `bwip-js` Code128 → PNG data URIs. `GET /barcode-labels/product|location/:id`,
  `POST /barcode-labels/batch`, location `?includeDescendants` (print a whole rack).
- Reference lookups: `GET /location-types`, `/units-of-measure`, `/suppliers`.
- Deps: exceljs, bwip-js, multer. Fixed 3 compile issues (Buffer typing, unexported interface).

**Frontend**
- `ProductFormModal` (create/edit), `ImportModal` (template → dry-run report → commit),
  `BulkCreateModal` (levels → preview → create), generic `Modal`. ADMIN-gated toolbars on the
  products & locations pages; **Print label(s)** buttons (products list batch, product detail,
  selected shelf) that open a print-ready label sheet.
- Verified: created a product via the form → auto barcode `INT-894986289`, detail shows Edit/Print;
  bulk-create preview "ZTEST1 · ZTEST2"; backend RBAC (keeper create → 403), dup SKU 409, import
  dry-run→commit→never-partial. Zero console errors.

> Note: API/UI testing added a few scratch products (PRD-T…, PRD-UITEST1, PRD-1001) and changed
> some stock. `npm run db:seed` resets the demo data.

### 2026-08-01 — AI Store Manager (Phase 2, task 2)
The full replenishment loop. **Backend verified via Python; the approve→PO→PDF loop verified in-browser.**

**Backend**
- `replenishment`: deterministic `reorder-calculator` (§8.2) + bilingual template `reasoning-generator`
  (§8.3 — no LLM). `POST /recommendations/run` (daily review), `GET /recommendations?status`,
  `POST /:id/approve` (amend when qty differs), `POST /:id/reject`. Skips products with an in-flight
  rec (PENDING/APPROVED/AMENDED/ORDERED) and any rejected today (§12 r6). All audited.
- `suppliers`: list + create/update (ADMIN), audited.
- `purchase-orders`: `POST /generate` groups approved/amended recs by supplier — one PO per supplier
  per run (§12 r7) — creates `PO-YYYY-####`, links recs (→ ORDERED), builds a **PDFKit PDF**, and
  emails it via `EmailService` (Nodemailer; inert + logged when SMTP unset). `GET /purchase-orders`,
  `GET /:id/pdf`.
- Verified: run→11 recs w/ EN+AR reasoning; approve/amend(999)/reject; generate→`PO-2026-0001`
  grouped by supplier, `skippedNoSupplier` counted; **valid PDF** (`%PDF-`); supplier create/update;
  re-run doesn't duplicate in-flight recs.

**Frontend**
- `ReplenishmentPage` (run review, recommendation cards with reasoning + approve/amend-qty/reject,
  generate POs), `PurchaseOrdersPage` (list + View PDF), `SuppliersPage` (list + add/edit modal).
  Wired routes + EN/AR translations. Verified: UI approve → generate → `PO-2026-0002` listed; zero console errors.

**AI service (`ai-service/`)** — FastAPI skeleton: `/health` + APScheduler daily job that calls the
backend's `/recommendations/run`; language-model provider abstraction (§2.1) for the Stage 2 assistant.
The deterministic engine stays in the backend (verifiable now); the split is recorded in OPEN-QUESTIONS #7.

### 2026-08-01 — Phase 3: reports, audit log, user management, cycle counting
The Phase 3 feature set. **Backend verified via Python; every page verified in-browser (zero console errors).**

**Backend**
- `users`: `POST /users` (argon2id + **password policy**: ≥12 chars + common-password blocklist, DESC #3),
  `PATCH /users/:id` (role/active/password reset), self-deactivation guard. Audited.
- `audit-log`: `GET /audit-log` (ADMIN) with filters (entityType/entityId/actorId/action/date), actor names.
- `reports`: `GET /reports/{stock-on-hand,stock-movements,replenishment}?format=pdf|xlsx` — ExcelJS + PDFKit
  (landscape tables), English-only (§10).
- `cycle-counting`: new `CycleCount` + `CycleCountLine` tables (migration `cycle_counts`). `POST /cycle-counts`,
  `POST /:id/scan` (snapshots stock, never mutates — §12 r4), `GET /:id` (live variance), `POST /:id/close?apply`
  — applies each non-zero variance as an audited **ADJUSTMENT** via the verified movements path.
- Verified: user create/weak-reject/deactivate/self-guard; audit 57 rows + filter; reports xlsx(`PK`)+pdf(`%PDF-`)
  for all three; cycle count scan variance +7 → apply → stock 20→27.

**Frontend**
- `UsersPage` (+ modal), `AuditLogPage` (filters + JSON details), `ReportsPage` (Excel/PDF downloads),
  `CycleCountPage` (session list → scan location→product→count → live variance table → close/apply).
  Routes wired; EN/AR translations.
- Verified in-browser: users list; audit 60 entries incl. the cycle-count adjustment; reports cards; and a full
  cycle-count UI run (scan → variance −5 → close & apply → stock 50→45).

**Note:** the compose stack (`docker-compose.production.yml`, nginx conf) + Stage-2 (GPU: Qwen, assistant,
forecasting) + DESC hardening (Redis denylist, rate limiting, real TLS, encrypted volumes, backups) remain
for the production/GPU move — see `documentation/gpu-readiness-and-upgrades.md`.

**MVP feature scope (Phases 0–3) is now functionally complete on the laptop.**

### 2026-08-03 — UX: remove Purchase Orders page + lean dashboard redesign
- **Removed the in-app Purchase Orders viewer entirely** (per request): nav item, `/purchase-orders`
  route (now redirects to dashboard), the "Purchase Orders →" link on Replenishment, the page file,
  and the unused PO client helpers. PO **generation** stays — approving recommendations →
  "Generate purchase orders" still creates + emails supplier POs (the core loop). Backend PO
  endpoints remain (used by generate).
- **Redesigned the dashboard** to be lean and non-technical-friendly: a "Welcome back, {name}"
  header, four plain-language stat cards (Products / Units in stock / Storage shelves / Suppliers,
  each with a one-line description), a **Stock health** bar (in-stock/low/critical/out with a legend),
  and a **"Needs your attention"** card ("N products need reordering" + critical/out counts + a
  *Review recommendations* button, or a positive "Everything's well stocked" state). Removed the old
  technical connection-diagnostic panel and designator strip. Verified in-browser (EN); bilingual.

### 2026-08-03 — Fix: location bulk-create (speed + UX)
- **Speed:** `bulkCreate` now pre-generates ids and inserts the whole subtree in ONE `createMany`
  (was a per-node loop). A full store room (1 + 6 racks + 30 levels = 37 nodes) now creates in **~25 ms**.
- **UX (BulkCreateModal rewritten):** pre-fills the levels that fit under the parent
  (New store room → Store Room / Rack / Level with SR/R/L prefixes); **instant client-side preview**
  ("Will create N locations" + sample designators) that updates as you type — no separate Preview
  round-trip; **Create works directly** (was disabled until you clicked Preview); clean wrapping row
  layout with labels and an always-visible delete button (no more horizontal scrolling). Invalidates
  only the location tree on success. Verified: prefill + live preview 3→37; create 37 nodes in 25 ms.

### 2026-08-05 — Differently-shaped demos + productization kickoff
- **Reusable per-customer demos** proved the config-driven design: a second demo (oil & gas style,
  4-level Depot>Zone>Rack>Bin) and a third demo (logistics style, 5-level Base>Warehouse>Aisle>Rack>Bin),
  each a SEPARATE database switched via `backend/.env` (labelled blocks). The main `mizan_inventory`
  demo untouched; reverted to it and deactivated 3 stray test products to restore the original 50.
- **Org-name branding**: `/system/info` now returns the org name from the DB; the navigation rail and
  login show the current customer's name (config-driven, works for any deployment). Removed a stale
  hardcoded credential hint from the login screen.
- **White-label Organization Settings** (new `organization` module + `/settings` screen): admin edits
  org name EN/AR, default language, timezone in-app (audited, ADMIN-only); rail/login update live.
  Keystone for running Mizan as a product across entities. Logo upload deferred until MinIO is wired.
- **New-entity provisioner** — `scripts/create-entity.ps1` + parameterised `backend/prisma/entity-seed.ts`
  stand up a fresh branded deployment in one command (create DB -> migrate -> append-only rules ->
  seed org + Warehouse>Aisle>Shelf hierarchy + units + admin/store-keeper, optional `-Sample` neutral
  catalogue). Prints the `.env` block + logins to switch. Verified by provisioning `acme_demo`
  (12 sample products) — the neutral fallback demo. **`-Sample` now also seeds 30 days of movements
  and PRE-SEEDS replenishment recommendations** by importing the real backend engine
  (`reorder-calculator` + `reasoning-generator`), so the Replenishment screen is full on first open
  (identical numbers/wording to a live run) — verified: 6 recommendations in `acme_demo`.
- **Sidebar demo-logins helper** — `/system/info` exposes the deployment's demo admin/store-keeper
  logins (from env; DEVELOPMENT ONLY, never in production); the nav rail shows a "Demo logins" button
  that reveals them on press. `.env` carries per-entity DEMO_* creds alongside each DB block.
- **Opt-in cloud-hosting path** (non-breaking) for a public "any device" demo, kept separate from the
  on-prem product: `API_BASE` is now `VITE_API_BASE_URL ?? '/api/v1'` (unset = local proxy unchanged);
  backend listens on `PORT ?? API_PORT ?? 3000` bound to `0.0.0.0` (local still 3000). New `hosting/`
  folder: `firebase.json` (Hosting + `/api` rewrite to Cloud Run), `.firebaserc.example`, and
  `HOSTING-GUIDE.md` covering two options — Cloudflare Tunnel (fastest, keeps everything local) and
  Firebase Hosting + Cloud Run + Cloud SQL (always-on). Verified local frontend/backend unchanged.
- **Jetson Orin Nano ordered** → Docker/production packaging AND Phase 2 AI (Ollama LLM, forecasting)
  are DEFERRED until it arrives. Deterministic reorder AI runs in the backend meanwhile (no GPU).
- Roadmap: (1) productize for any entity [DONE: white-label, provisioner, sidebar logins, cloud-host
  path], (2) production Docker/nginx/TLS/backups [DEFERRED → Jetson], (3) DESC hardening,
  (4) tests/accessibility/fonts, (Stage 2) AI assistant + forecasting [DEFERRED → Jetson].

### 2026-08-04 — Dark theme "Graphite" + safe delete on master data
- **Dark theme swapped to "Graphite"** (client choice): neutral warm-grey panels + teal-cyan primary
  (`--primary #46A9BE`, `--canvas #141518`). Updated both dark blocks in
  `shared/design-tokens/design-tokens.css` (explicit toggle + `prefers-color-scheme` fallback) and
  synced the spec (`CLAUDE.md` §9.4). Light theme unchanged. All `-soft` tints re-derived.
- **Safe delete added** (Users, Products, Locations, Suppliers). The system is "deactivate, never
  delete" for audit (§5A.2); there are **no FKs**, so delete is guarded in application code: a record
  is hard-deleted **only when nothing references it**, otherwise a localised `409` tells the user to
  deactivate instead. Every delete writes an `*_DELETE` audit entry in the same transaction (§12 r8).
  - Guards — Users: not self, not last admin, no movements/decisions/cycle-counts/audit-actor rows.
    Products: no stock position, movement, recommendation or count line. Locations: **subtree cascade**
    — a store room deletes with its empty racks/levels in one action when the whole subtree holds 0
    units and has no history; any stock (even 1 unit) → blocked (`LOCATION_HAS_STOCK`, transfer first);
    stock history but 0 units → blocked (deactivate instead). Suppliers: not used by any product or PO.
  - `DELETE /users/:id`, `/products/:id`, `/storage-locations/:id`, `/suppliers/:id` (all ADMIN).
  - Frontend: reusable `ConfirmDialog` (owns busy/error, shows the backend's "deactivate instead"
    message inline); trash actions on Users/Suppliers rows, Product detail header, Locations tree rows.
  - EN/AR strings added. Fixed a latent type bug: `Supplier` interface was missing `phone`.
  - **Verified end-to-end** against the running API: unused user create→delete→gone; self-delete
    blocked; product with 78 units blocked (`PRODUCT_HAS_HISTORY`); fresh no-stock product deleted.

### 2026-09-02 — Stage 2: AI assistant + demand forecasting, live on the Jetson
The Jetson Orin Nano has arrived; this session is running on it. Scope (by request): Stage 2 AI
only (§8.4 assistant + §8.2 Stage-2 forecasting) — production Docker/nginx/TLS packaging stays
deferred. Everything below runs natively (uvicorn + the existing native systemd Ollama), matching
how backend/frontend already run on this box. **Corrected the stale "Current phase" header above**
(it had said "Phase 0" — Phases 0–3 were actually complete since 2026-08-01).

**Model choice — real hardware testing, not the spec's assumption.** The spec named
`qwen2.5:14b-instruct-q4_K_M` for `qwen-production`; this is an 8GB unified-memory board. Tested
directly under real concurrent load (backend+frontend+Postgres+Ollama together): 14B never fit,
7B previously failed (user-confirmed), default-quant `qwen2.5:3b` worked but left ~100-250MB free
and crashed once under real startup load, and quantizing 3B further made things *worse* — `q2_K`
produced gibberish, `q3_K_M` hallucinated a wrong Arabic total (8 instead of 12, violating §8.4's
"never invent numbers"). **Landed on `qwen2.5:1.5b`**: 1.3-2.7GB headroom, comfortably ahead of
3B. Recorded with full reasoning in `OPEN-QUESTIONS.md` #8. `model_profiles.py` updated;
`arabic_verified=False` — not assumed true just because it's the "production" slot.
`qwen2.5:1.5b` later hit the same CUDA-allocator error once too, on a cold load with over 1GB
free RAM at the time — confirming this is a Jetson driver-level flake on cold load, not really a
model-size problem. An immediate retry always succeeded, so `OllamaProvider.complete()` now
retries once automatically before giving up.

**Backend** (`backend/src/`)
- New `ai-service-client/` module: plain-`fetch` client to the internal-only ai-service (matches
  the project's existing minimalism — no `@nestjs/axios`).
- New `modules/assistant/`: `POST /assistant/query` (§7), JWT-guarded, every query audited
  (`ASSISTANT_QUERY`, DESC #9) — built exactly on the `modules/replenishment/` pattern.
- `modules/replenishment`: `POST /recommendations/run` gained an **optional** `forecasts` body
  (per-product `dailyUsage` override + `FORECAST_DEPLETION`/`SEASONAL_UPLIFT` reason code) —
  additive only; the manual "Run now" trigger and the deterministic 30-day-average path are
  unchanged when no forecast is supplied (§8.2: same interface, only the input changes).
  `reasoning-generator.ts` gained bilingual templates for the two new reason codes — still pure
  template text, never LLM output (§8.3 invariant preserved).
- `modules/stock-movements`: added a bounded `limit` query param (was hardcoded to 100) so Stage-2
  forecasting can pull a product's full trailing history.
- `.env.example`: added `SERVICE_ACCOUNT_EMAIL`/`_PASSWORD` (the Python config already defaulted
  these but the template never had them — a real gap found in research).

**ai-service** (`ai-service/src/`) — first real code beyond the `/health` + daily-trigger skeleton
- `assistant/query_router.py`: keyword-based intent classification (6 intents, EN+AR) +
  `match_product()` — SKU/substring match, then word-overlap scoring, then `difflib` fuzzy fallback.
  **No embeddings** (`sentence-transformers`/FAISS) — see `OPEN-QUESTIONS.md` #9: this board is
  already memory-marginal with just Ollama loaded, so a second resident ML model wasn't worth the
  reintroduced OOM risk at a 50-product catalogue.
- `assistant/inventory_data_retriever.py`: authenticated backend calls (reuses the daily job's
  service-account login pattern, with token caching).
- `assistant/response_composer.py`: uses the existing `LanguageModelProvider` abstraction to phrase
  retrieved data — and **verifies its own output** before returning it (every number from the data
  must appear in the answer, AND the answer must be in the requested language), falling back to a
  plain deterministic sentence built from the same data otherwise. This is not defensive boilerplate
  — real testing on this hardware caught two genuine failures this net exists to catch (see below).
- `demand_forecasting/`: `consumption_history.py` (pulls + zero-fills daily history via the new
  `limit` param), `seasonal_analyser.py` (returns "no uplift" below a 90-day minimum — this
  deployment has ~28 days of history, so `SEASONAL_UPLIFT` won't fire yet, honestly),
  `forecast_models.py` (statsmodels exponential smoothing, `None` below 30 days of history →
  caller falls back to the backend's plain trailing average).
- `daily_review_job.py`: now computes forecasts per active product before triggering the backend
  review, passing them in the `forecasts` body.
- `requirements.txt`: `statsmodels` uncommented; `sentence-transformers`/`faiss-cpu` stay commented
  (see above). Hit a real ABI conflict getting there: apt's system `scipy` (built for NumPy 1.x) vs.
  pip's NumPy 2.x — fixed with `pip install --user --upgrade scipy`.
- `pytest` added (28 tests, all passing): intent classification, product matching (including two
  real regressions found live — see below), forecast/seasonality fallback logic, and the composer's
  language/numeric verification.

**Real bugs found and fixed by testing against the actual running stack, not just unit tests:**
1. `match_product` scored a short query ("coffee") against a longer product name ("Instant Coffee
   200g Jar") too low via plain similarity ratio — added word-overlap scoring as a middle tier.
2. `_extract_facts` walked the *entire* raw product-detail API response (including irrelevant
   fields like `reorderPoint`/`minLevel`/`maxLevel`), making verification impossible to pass for a
   correct, natural answer — fixed by scoping what's passed to the composer per intent.
3. A raw Python-dict-repr prompt caused the model to mislabel a product *count* as a unit *count*
   ("42 units in stock" instead of "42 products in stock") in an English summary — fixed by
   formatting prompt data as plain labeled text instead of a dict repr.
4. Arabic definite article ("ال") wasn't stripped, so "السكر" (the sugar) didn't match a catalogue
   entry named "سكر" — fixed, but exposed bug 5.
5. Punctuation wasn't stripped before matching — "السكر؟" (with the trailing Arabic "؟") silently
   fell through to the fuzzy tier and matched an unrelated product (hand sanitizer). Fixed by
   stripping punctuation in `_normalize`; added regression tests for both this and bug 4.
6. **The most serious**: asked a question in Arabic, `qwen2.5:1.5b` answered fluently in *English*
   — every number correct, so the numeric-only verification would have let it straight through.
   Added a language-conformance check (`_is_in_requested_language`, script-majority heuristic that
   tolerates Latin SKUs/designators per §10) to the composer's verification gate.

**Frontend** (`frontend/src/`)
- New `design-system/drawer/Drawer.tsx` — edge-anchored panel primitive (flips side automatically
  in RTL via a logical `insetInlineEnd`), reusing `Modal`'s backdrop pattern.
- New `features/assistant/`: `AssistantPanel.tsx` (message list + input, tokens only, no chat-bubble
  styling per §9.2), `assistant.store.ts` (Zustand open/close, matches the `preferences.store`
  pattern). Wired the existing-but-unused `app.developmentModelBadge` translation key to the
  response's `isDevelopmentModel` flag — the badge finally has a real consumer.
- `TopBar.tsx`: new assistant trigger icon button. `ApplicationShell.tsx`: renders the panel at
  shell level (not a route — a global slide-over). `api-client/client.ts`: `queryAssistant()`.
  `assistant.*` namespace added to both translation files.
- **Verification note**: no browser automation tool was available in this session (no Chrome
  extension connected on this headless Jetson) — confirmed TypeScript compiles clean for all new
  files (`tsc --noEmit`, zero new errors) and the dev server serves without console errors, but
  **did not visually verify the panel renders correctly in an actual browser**. The full API call
  chain it depends on (frontend → backend → ai-service → Ollama → backend) was verified end-to-end
  via direct testing. Flagging this gap explicitly rather than claiming a full UI verification that
  didn't happen.

**DESC evidence**: `documentation/security-compliance/language-model-validation.md` written — the
§2.2 gate **does not pass** for Arabic (concrete failure examples documented honestly, including
the wrong-language bug above), consistent with treating `qwen2.5:1.5b` like any other
development-class model until proven otherwise. `control-implementation-matrix.md` updated
(control #9 extended to `ASSISTANT_QUERY`; control #11 — native run isolation noted as equivalent-
but-not-identical to the Docker-network form, pending the deferred production packaging).

**Not done this session** (honest gaps, not silently dropped): Jest specs for the new backend
module; Vitest for the frontend assistant panel; in-browser UI verification (see above); production
Docker/nginx packaging for any of this (native run only, by explicit scope decision).

**Same-day follow-up — flexibility + guardrails, from live user feedback**
"Should I reorder Bottled Water 1.5L (6s)?" returned a flat refusal — root cause: no intent
recognised "should I reorder" phrasing at all, so the router never even attempted a product
match. Fixed properly, not papered over:
- New `Intent.REORDER_ADVICE` (EN+AR keywords). When a formal recommendation already exists for
  the matched product, the answer **reuses that recommendation's deterministic §8.3 reasoning
  verbatim** rather than re-phrasing already-vetted text through the LLM — `isDevelopmentModel:
  false` in that case, since no LLM touched it. Otherwise falls to the normal
  compose/verify/fallback path.
- **Typo tolerance**: a conservative (0.82 threshold) `difflib`-based fuzzy pass now runs when no
  keyword matches exactly, so "shuld i reoder botled watr" still routes and matches correctly —
  tested and passing.
- **`Intent.GENERAL_CHAT`** replaces the old `UNKNOWN` dead-end: unmatched or genuinely off-topic
  questions now get a real conversational answer instead of a canned refusal, and the same
  guardrailed path also covers "product-required intent but no confident match" (a clarifying
  response instead of silence). The guardrail is in the system prompt: the model is told
  explicitly it has **no real inventory data** in this mode and must never state a specific stock
  figure as fact — verified live (asked "what is the capital of France?" → answered correctly,
  no fabricated inventory data).
- **Found via this same testing, not before**: `qwen2.5:1.5b` hit the CUDA cold-load flake noted
  above mid-test — this is what surfaced it. Fixed with the provider-level retry (see above), then
  re-verified the exact failing case recovered correctly.
- All additions covered by new `pytest` cases (32 passing total); re-verified the originally
  reported case live end-to-end after the fix.

**UI**: per request, moved the assistant trigger from the top bar to a persistent floating round
button in the bottom corner (`AssistantLauncher.tsx` — the common chat-widget convention),
`insetInlineEnd` so it flips side automatically in RTL. Styled with the app's own tokens
(`--primary`, `--shadow-floating`) rather than a generic gradient bubble — the circle is a
deliberate one-element exception to §9.5's radius cap, same reasoning as the gold accent (§9.1).
Hides itself while the panel is open. `tsc --noEmit` clean; Vite HMR picked up the change with no
errors (still no in-browser visual check possible this session — see the earlier note).

### 2026-09-02 (same day, second follow-up) — real generality: tool-calling
User feedback: "which dairy and creamers category products is about to finish?" got no answer,
and asked "is there a limitation?" There was a real, structural one — the fixed ~7-intent keyword
menu had no path to real data for anything outside it (any new filter/phrasing needed a code
change). Fixed at the root, not with another one-off keyword:

- **Tool-calling tier added** (`tool_definitions.py`, `LanguageModelProvider.complete_with_tools`,
  implemented in `OllamaProvider` via Ollama's `tools` param). 6 tools mirror the same real
  backend queries the keyword router already used, plus `search_products` which — new —
  supports a category filter. Confirmed live: `qwen2.5:1.5b` correctly extracted
  `{"category": "dairy", "low_stock_only": true}` from free-form English with an explicit
  "always call a tool" system prompt (without that instruction, it just chatted instead).
- New `match_category()` (`query_router.py`) resolves a model-extracted category name (e.g. "dairy
  and creamers") to a real category via substring + `difflib` fuzzy matching, same pattern as
  product matching. New `product_categories()`/`search_products()` on the retriever.
- **Priority order, tuned after a real regression**: tried tool-calling first initially — this
  broke "should I reorder Bottled Water 1.5L (6s)?" (previously fixed earlier the same day),
  because the model picked `get_product_detail` instead of `check_reorder` for a question the
  keyword router already answered exactly right. **Fixed**: keyword router runs first (precise,
  tested); tool-calling only runs when the keyword router's fixed menu matches nothing at all —
  extends coverage rather than risking a worse answer to something already handled. Tool-calling
  also gets one retry (the model doesn't reliably produce a tool call on the first attempt,
  confirmed worse in Arabic).
- **A further, more serious Arabic finding** from this same testing: even with the strict
  guardrail prompt and a retry, an unresolved Arabic dairy-category question got a **fabricated**
  answer — invented fake sub-category names not in the catalogue, with no number present for the
  existing verification to catch. English handled the identical scenario correctly (a genuine
  general-knowledge question, answered correctly, no fabrication). Given prompting alone didn't
  prevent this, **Arabic's general-chat fallback tier now skips LLM generation entirely** and
  returns a fixed safe message — deterministic, not a prompt tweak. Real UX cost for genuine
  Arabic small talk, accepted deliberately over fabrication risk. Covered by a test that asserts
  this is structural (`test_compose_general_arabic_never_calls_the_model` — fails if the provider
  is ever called for Arabic in this path).
- `pytest-asyncio` added; 38 tests passing (was 32). All three originally-reported live cases
  re-verified working after the fixes: "should I reorder Bottled Water" (verbatim recommendation
  reuse restored), "capital of France" (still answers, not over-restricted), dairy category in
  English (correct, grounded) and Arabic (safe fallback, no fabrication).
- `language-model-validation.md` and `OPEN-QUESTIONS.md` (#10, #11) updated with the full
  reasoning — the §2.2 gate remains **not passing** for Arabic; this update sharpens why (not only
  fluency, but a real, now-mitigated fabrication risk).

### 2026-09-02 (same day, third follow-up) — "critical" status, found in the actual browser panel
User tested the panel live (not curl) and reported 7 different rephrasings of "which product is
critical" all failing with a flat refusal, plus a follow-up "check on this" once fixed. Two
distinct causes, both fixed:

- **"critical" was never a recognised keyword anywhere** — added it (+ "out of stock", "about to
  finish", "running out", EN+AR) directly to the keyword router rather than leaning on
  tool-calling for such a common, simple word. Confirmed directly against Ollama: the model
  reliably calls a tool for imperative phrasing ("list critical products") but not interrogative
  phrasing ("which product is critical") — a real, repeatable small-model limitation, not
  something a better tool description fixed (tried; didn't help).
- New `detect_severity_filter()` (`query_router.py`): "critical stock" and "out of stock" cover
  LOW+CRITICAL+OUT together; a question specifically about "critical" wants only that narrower
  slice. Applied as a post-filter in `_search_products_response` (backend has no granular status
  query param), used uniformly whether the request came from the keyword router or a tool call.
- New `clean_search_text()`: a tool call sometimes echoed generic status vocabulary back as
  `search_text` (e.g. `"critical"`), which would have silently zeroed out real results since no
  product name contains that word. Dropped if it's pure noise-word vocabulary.
- All 7 originally-failing rephrasings ("what is the critical product" through "which product in
  critical status") re-verified live — all now correctly name **Floor Cleaner 5L, 5 units**, the
  one real critical item (matches the dashboard's "1 critical" count). Regression-checked: general
  "list all low status products" still returns all 8 items; "should I reorder Bottled Water" still
  reuses the deterministic recommendation.
- 6 new tests (44 passing total, was 38). `OPEN-QUESTIONS.md` #12 updated.

### 2026-09-02 (same day, fourth follow-up) — tone: facts-only → helpful and emphatic
User feedback: answers were flat fact statements ("There are 5 units of the Floor Cleaner 5L
product available in stock.") with no emphasis or suggestion — wanted something more like
Claude/ChatGPT's tone.

- `_SYSTEM_PROMPT` reworded ("a knowledgeable colleague, not a report generator... write with
  appropriate emphasis") for both languages.
- **Scoped, not blanket**: a new `_URGENCY_GUIDANCE` addendum (explicitly encouraging "critically
  low" language and reorder suggestions) is appended **only** for `LOW_STOCK_LIST` and
  `REORDER_ADVICE` — the two intents whose data is, by definition, already at/below the reorder
  point, so flagging urgency is a grounded inference, not an invented judgement. Deliberately NOT
  applied to `STOCK_LEVEL` (that data has no `reorderPoint` context, so a reorder opinion there
  would be an unsupported guess) — verified live: "how much coffee do we have" stayed neutral,
  correctly.
- The **deterministic fallback templates** for these two intents got the same tone upgrade (e.g.
  REORDER_ADVICE's "No" case now says the product "is fine for now"), so the safety net doesn't
  regress to a flat sentence when the LLM's composition fails verification.
- Verified live, 3 repeated attempts of "which product in critical status": all three showed real
  emphasis and a clear suggestion ("necessitating immediate reordering," "needs to be reordered
  soon," "requires immediate reordering") — a real improvement, not a one-off. Regression-checked
  unaffected: "should I reorder" (still uses the deterministic recommendation reasoning, already
  had this tone via §8.3's templates) and plain stock-level questions (correctly stayed neutral).

### 2026-09-23 — Unit cost + 120-day movement history (seed only — no dashboard UI exists yet)
Requested so a "Predictive Analytics Dashboard / Projected Spend panel" shows real numbers at a
demo. **That dashboard does not exist in this codebase** (grepped everywhere, confirmed against
this file's own history) — see `OPEN-QUESTIONS.md` #13. Scope was schema + seed data only, per
the request's own numbered sections; no UI was invented to fill the gap.

**Schema** (`backend/prisma/schema.prisma`, migration `20260923062617_add_product_unit_cost_and_org_currency`)
- `Product.unitCost` — nullable `Decimal(10,2)`, cost per base unit as tracked (per box/carton/
  bottle, matching how `StockPosition`/movement quantities already count). Nullable so nothing
  existing breaks.
- `Organization.currency` — `String @default("AED")`. Seed data gets it for free (schema default);
  didn't wire it into the editable Organization Settings form — not asked, and that's separate
  UI-scope work.
- Surfaced both through the API (previously would've been silently invisible): `unitCost` added to
  `products.service.ts`'s `list()`/`getById()` mappings (explicit field lists, not spreads — had to
  be added by hand; converted from Prisma's `Decimal` to a plain `Number` so it doesn't silently
  serialise as a string), `currency` added to `organization.service.ts`'s `pick()` (read-only via
  `GET /organization`; not added to the `PATCH` DTO).

**Seed data** (`backend/prisma/seed.ts`)
- All 50 products got a hand-assigned AED `unitCost` (not a flat per-category rate) — realistic
  wholesale/institutional figures, deliberately non-round, ranging AED 5.90 (plastic teaspoons) to
  AED 168.00 (Printer Toner Black — the one equipment-adjacent consumable, priced as the deliberate
  outlier per "equipment/asset items higher").
- Movement history extended from ~30 to **120 days**, daily-ish rather than a handful of sparse
  events, because the ai-service Stage-2 forecaster needs real depth:
  `forecast_models.MIN_HISTORY_DAYS_FOR_FORECAST = 30`, `seasonal_analyser.MIN_HISTORY_DAYS_FOR_SEASONALITY
  = 90`. 120 real days clears both. Each product's daily quantity = `baseDailyUsage × weekdayFactor
  × trendFactor × noise`: a UAE Sat/Sun weekend factor (0.45×, work-week since Jan 2022), a
  multiplicative noise band (0.55-1.45×) so no two days look alike, and — for 5 specific SKUs
  already sitting at/below their reorder point in the existing stock seed (PRD-0006, -0013, -0031,
  -0043, -0049) — a trend factor ramping 0.7× to 1.9× across the window, a genuine recent
  acceleration rather than a label bolted on afterward. Every other product (the large majority)
  stays flat: weekday/weekend + noise only, no trend — this is what keeps most of the catalogue
  reading as healthy, same as before. Two `GOODS_IN` restocks per product (opening + mid-window)
  keep the movement-trend view showing real inbound activity too. Inserted via chunked
  `stockMovement.createMany` (500/batch) instead of the old per-row `create` loop — 4,502 rows in
  under 6 seconds.
- `dailyUsageBySku` (feeds the pre-seeded recommendations, same deterministic engine as a live "Run
  now", §8.2) now sums only the **trailing 30 days** of the new 120-day history, not the full-window
  average — matches exactly what a fresh manual run would compute today, so the pre-seeded
  recommendations stay honest, not inflated by the older window.
- `backend/prisma/entity-seed.ts` (the `-Sample` provisioner) got the same two treatments at its
  smaller scale: `unitCost` on all 12 sample products, and its movement generation extended from
  ~28 to ~120 days (weekday/weekend + noise, no trend group — proportionate for a lighter demo
  catalogue). Verified by provisioning a real throwaway `mizan_scratch_verify` database end to end
  (`ENTITY_SAMPLE=true`) and dropping it after — seed completed cleanly, 12/12 products carry
  `unitCost`, movement span 119 days.

**Verified** (against the real re-seeded `mizan_inventory` dev DB, not assumed):
- `unitCost`: 50/50 active products, 0 missing.
- Projected-spend proxy (`dailyUsage(30d) × unitCost × 30`, computed directly from the DB — there's
  no panel to read it from): **AED 29,702.50/month total**, varying genuinely by supplier (AED
  2,472-8,876) and by category (AED 2,472-6,983) — not flat, not uniform.
- Days-to-stockout (`currentStock / dailyUsage(30d)`): the 5 accelerating SKUs land at 7-10 days
  (Sweetener Tablets 7, Hot Chocolate 8, Bakhoor 8, Sticky Notes 9, Multi-Surface Cleaner 10) — the
  requested 7-14-day "trending toward stockout" band, arrived at from real usage math, not
  hand-set. 40 products sit healthy (>30 days). 0 products have no usage at all.
- Ran the **actual** `ai-service` forecasting code (not a re-implementation) against real exported
  movement rows for 3 products: `forecast_daily_usage()` returned real floats for all three (never
  `None` — the 30-day-minimum gate is cleared with margin). `detect_seasonal_uplift()` returned
  `True` only for PRD-0006 (the accelerating group) and `False` for the two flat products — the
  seasonal signal is genuinely present in the data, not asserted.
- History depth: every product's `GOODS_OUT` span is 106-119 days; 0 products fall below either the
  30-day or 90-day thresholds.
- **Known, documented gap** (`OPEN-QUESTIONS.md` #14): `StockMovement` is append-only and the seed
  has never deleted it (by design), but `Product` rows get fresh IDs every re-seed — so old
  movement generations become orphaned, unreachable rows rather than being cleaned up. Already true
  before this session; deeper history made the accumulation bigger (this run added 4,502 rows) and
  matter more, since 397 stale rows from earlier in this DB's life now sit alongside the fresh ones
  (confirmed via direct count, not estimated). Left alone deliberately — cannot delete without
  violating DESC control #10, and a full database drop/recreate is a bigger, more destructive step
  than this task asked for.

**Not done** (out of this task's stated scope, not silently skipped): no Projected Spend UI, no
forecast-vs-actual chart, no days-until-stockout ranking screen — see the "doesn't exist" note
above. No changes to the Organization Settings screen to make `currency` editable.
