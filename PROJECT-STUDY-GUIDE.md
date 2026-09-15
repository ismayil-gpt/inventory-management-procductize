# Mizan — Project Study Guide

> A single, complete reference to everything built in this project. Read this to understand what
> Mizan is, how it works, what has been done, how to run it, and what is left. For the authoritative
> build specification see [`CLAUDE.md`](CLAUDE.md); for the dated build log see [`PROGRESS.md`](PROGRESS.md);
> for a plain-language checklist see [`THINGS-TO-DO.md`](THINGS-TO-DO.md).

---

## 1. What Mizan is (the one-minute version)

**Mizan** (ميزان = "balance/scales") is an **AI-assisted inventory management system** for stock rooms.
It is:

- **A product, not a one-off.** Built by **Grow Plus Technologies** to serve any organization, not
  one fixed customer. The storage structure, product catalogue, and vocabulary are all
  **configuration in the database, never code** — so the *same* software runs a coffee/stationery
  store room, an oil depot, or a defense warehouse with **zero code changes**.
- **On-premise by design.** No cloud services, no external API calls at runtime (the only permitted
  outbound traffic is SMTP for supplier emails). This is the core selling point for government /
  defense / regulated buyers: data residency and air-gap capability.
- **Bilingual** (English + Arabic, full right-to-left), **DESC-compliant** (Dubai Electronic Security
  Center controls), and built with a distinct "instrument panel" visual design.

**The governance rule that defines the product:** *the AI recommends; a human always approves.* The
system never places an order autonomously.

---

## 2. What the system does (the core loop)

1. Every **product** and every **shelf location** carries a barcode.
2. A **Store Keeper** scans a location, then scans products, and records a **movement**
   (goods in / goods out / transfer / cycle count / adjustment).
3. Stock quantity and exact physical location update in real time; an **immutable audit record** is
   written in the same database transaction.
4. Each day the **AI Store Manager** reviews stock, consumption, and supplier lead times and decides
   what needs reordering — **with the reasoning behind it, in both languages**.
5. It notifies the officer. The **Administrator** approves, amends, or rejects.
6. On approval, the system generates a **PDF purchase order** grouped by supplier and emails it.
7. Goods arrive, are scanned in, and the cycle closes.

---

## 3. Technology stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript (strict), Vite 5, React Router v6, TanStack Query, Zustand (theme/lang/auth/offline), react-i18next (EN/AR), Dexie (IndexedDB offline queue), lucide-react icons, Tailwind (default palette disabled, mapped to design tokens) |
| **Backend** | NestJS 10 + TypeScript (strict), Prisma ORM, PostgreSQL 18 (spec says 16), Passport JWT (access + refresh), `@node-rs/argon2` (argon2id), Zod validation, PDFKit (PDFs), ExcelJS (Excel), bwip-js (Code128 barcodes), Nodemailer (SMTP) |
| **AI service** | Python FastAPI + APScheduler (scheduled daily trigger), language-model provider abstraction for the future LLM assistant (Ollama). **Note:** the deterministic reorder engine lives in the *backend*, not here — see §12. |
| **Database** | PostgreSQL 18 on `localhost:5432` (Windows service, no Docker locally). App connects as a dedicated least-privilege role `mizan`, never as the `postgres` superuser. |

**Ports:** backend API `:3000` (prefix `/api/v1`), frontend dev server `:5173`, PostgreSQL `:5432`.

---

## 4. Architecture — how the pieces connect

```
Browser (React SPA :5173)
   │  calls /api/v1/*  (Vite dev-server proxies /api → :3000 locally)
   ▼
NestJS backend (:3000)  ── Prisma ──►  PostgreSQL (:5432)
   │                                     (mizan_inventory + demo DBs)
   ├─ SMTP (Nodemailer) ──► supplier email  (only permitted outbound)
   └─ (future) AI service (FastAPI) on the internal network for the LLM assistant
```

- The **deterministic replenishment engine runs inside the NestJS backend** (pure functions
  `reorder-calculator.ts` + `reasoning-generator.ts`). It needs **no GPU** and works today.
- The Python **AI service** only hosts the scheduled trigger and will host the Stage-2 conversational
  LLM assistant (deferred until the GPU box arrives).

---

## 5. Repository structure (the important parts)

```
Inventory Management Productize/
├── CLAUDE.md                     ← the build specification (source of truth)
├── PROGRESS.md                   ← dated build log
├── THINGS-TO-DO.md               ← plain-language checklist
├── PROJECT-STUDY-GUIDE.md        ← this file
│
├── backend/                      NestJS API
│   ├── .env                      ← active DB + secrets (git-ignored)
│   ├── prisma/
│   │   ├── schema.prisma         ← the data model
│   │   ├── migrations/           ← init + cycle_counts
│   │   ├── seed.ts               ← generic demo data
│   │   └── entity-seed.ts        ← parameterised generic seed (any new entity)
│   └── src/
│       ├── main.ts               ← bootstrap (helmet, CORS, prefix, swagger, PORT)
│       ├── app.module.ts
│       ├── database/             PrismaService (+ @Global PrismaModule)
│       ├── security/             ZodValidationPipe, guards
│       ├── email/                Nodemailer
│       └── modules/              one folder per capability (see §9)
│
├── frontend/                     React app
│   ├── vite.config.ts            ← dev proxy /api → :3000, @shared alias
│   └── src/
│       ├── application-shell/     NavigationRail, TopBar, StatusStrip
│       ├── features/             one folder per screen (see §9)
│       ├── design-system/        Modal, ConfirmDialog, LocationDesignator, etc.
│       ├── api-client/client.ts  ← all typed API calls + React Query hooks
│       └── internationalisation / offline-queue / preferences
│
├── shared/                       used by both apps
│   ├── design-tokens/design-tokens.css   ← the single source of colours/spacing/type
│   └── translations/{english,arabic}.json
│
├── database/migrations/0001_append_only_rules.sql   ← audit immutability (applied to every DB)
├── scripts/create-entity.ps1     ← one-command new-entity provisioner
├── hosting/                      ← opt-in cloud-demo hosting (firebase.json + guide)
└── documentation/security-compliance/   ← DESC evidence
```

---

## 6. Environments — now vs later

| | **Development (now, laptop)** | **Production (later, on the Jetson/GPU)** |
|---|---|---|
| Language model | Llama 3.2 3B (dev) | Qwen 2.5 14B (prod) |
| Model runtime | Ollama on CPU | Ollama on GPU |
| Deploy | native `npm run dev`/`start:dev` | Docker Compose + nginx + TLS |
| TLS | none locally | real certificate at nginx |

**Key principle:** the architecture never changes between environments — **only configuration**
(environment variables) does. The language model is swapped by one env var
(`LANGUAGE_MODEL_PROFILE`) via a provider abstraction; no feature code names a model.

> **A NVIDIA Jetson Orin Nano has been ordered.** Docker/production packaging **and** Phase 2 AI
> (Ollama LLM, forecasting) are **deferred until it arrives**. Everything else runs today on the laptop.

---

## 7. Data model (Prisma — `backend/prisma/schema.prisma`)

Core entities and why they matter:

- **Organization** — one row per deployment (the "customer"). Carries `code`, `nameEn/nameAr`,
  timezone, default language, logo. Every tenant-owned row has `organizationId` (multi-tenant-ready,
  though multi-tenancy itself is deliberately *not* built).
- **LocationType** — defines the *shape* of storage for this deployment (e.g. `STORE_ROOM > RACK >
  LEVEL`). **This is data, not code.** `canHoldStock` marks the one level that actually stores goods.
- **LocationNode** — a single **self-referencing tree of arbitrary depth** that replaces fixed
  room/rack/level tables. Each node caches a `designator` (ancestor codes joined by `-`, e.g.
  `SR1-R1-L1`) and a `materialisedPath` for fast subtree queries. Stock-holding leaves get a barcode.
- **ProductCategory** (nesting tree), **UnitOfMeasure**, **ProductAttributeDefinition** (custom fields
  per deployment) — all configuration.
- **Product** — sku, barcode (manufacturer or internal-generated), names EN/AR, category, base unit,
  pack size, reorder/min/max levels, supplier, custom attributes, `isActive`.
- **StockPosition** — quantity of a product at a stock-holding location (unique per product+location).
- **StockMovement** — GOODS_IN / GOODS_OUT / TRANSFER / CYCLE_COUNT / ADJUSTMENT. **Append-only.**
  Idempotent on a client-generated `clientId`.
- **Supplier**, **Recommendation** (AI reorder suggestion + bilingual reasoning + status),
  **PurchaseOrder**.
- **AuditLog** — every state change, with before/after JSON. **Append-only.**
- **CycleCount** + **CycleCountLine** — stock-take sessions (counting never mutates stock directly).

**Append-only enforcement:** `database/migrations/0001_append_only_rules.sql` installs PostgreSQL
rules that make `UPDATE`/`DELETE` on `AuditLog` and `StockMovement` silently do nothing — a DESC
control enforced at the database itself, applied to **every** database (including the demos).

**Important structural fact:** the schema has **no foreign-key constraints** — references are plain
string ids. This is why the delete feature (§9) checks references in application code.

---

## 8. The configurable-hierarchy concept (the product's differentiator)

This is the single most important design idea and the strongest sales point. The same code models any
storage shape because the hierarchy is data:

| Example deployment | Configured hierarchy | Depth | Example designator |
|---|---|---|---|
| Aviation store room | Store Room → Rack → Level | 3 | `SR1-R1-L1` |
| Oil & gas depot | Depot → Zone → Rack → Bin | 4 | `JAD-Z1-R1-B1` |
| Defense logistics | Base → Warehouse → Aisle → Rack → Bin | 5 | `ADM-WH1-A1-R1-B1` |
| **Generic** (new entity default) | Warehouse → Aisle → Shelf | 3 | `W1-A1-S1` |

The signature UI element — the **location designator strip** — renders any depth (it takes an array of
segments, not three fixed values). Vocabulary ("Store Room" vs "Warehouse") comes from the
`LocationType` records, so the interface re-labels itself per customer, in both languages.

---

## 9. Features built (Phases 0–3 + productization) — the full tour

Everything below is **built, working, and verified**. Each backend module lives in
`backend/src/modules/<name>/`; each screen in `frontend/src/features/<name>/`.

### Authentication & access control
- JWT (access 15 min + refresh 7 days), argon2id password hashing, **account lockout** (5 attempts →
  15 min), no account enumeration, localised error envelope.
- Role guard (`ADMIN`, `STORE_KEEPER`) enforced at the controller — never trusted from the client.
- Frontend: `auth.store` (Zustand + localStorage), `authFetch` with automatic refresh-and-retry,
  `RequireAuth` route guard, real login page.

### Dashboard
- Lean, non-technical: "Welcome back, {name}", four stat cards (Products / Units in stock / Storage
  shelves / Suppliers), a **Stock-health bar** (in-stock / low / critical / out), and a **"Needs your
  attention"** card (count needing reorder + a *Review recommendations* button, or "Everything's well
  stocked").

### Product catalogue
- List (search, category filter, low-stock toggle), detail (info + "where it's stored" positions),
  create/edit modal (ADMIN), **auto internal barcode** (`INT-#########`) when none is given.
- **Excel import** with a downloadable template and a **dry-run** that validates every row — never a
  partial import (commits only if all rows are valid).
- **Barcode label printing** (Code128 via bwip-js) — per product, batch from the list, or a whole rack.

### Storage locations
- Real **tree view** with expand/collapse and item/unit **rollups** from stock-holding descendants.
- **Bulk-create generator** (§5A): pick levels/prefixes/ranges → **instant client-side preview** →
  create a whole subtree in one `createMany` (a full store room = 37 nodes in ~25 ms).
- Location-type configuration and per-node rename/deactivate. Barcode resolve → designator strip.

### Barcode scanning (`features/barcode-scanning/`)
- **Two modes:** *Manual entry* (works today) and *Scan* (deliberately stubbed — "Scanner not
  connected … device coming soon" until the wireless HID unit is bought).
- **Location-first flow:** scan the shelf once, then scan many products onto it.

### Stock movements + offline outbox
- `POST /stock-movements` — **idempotent on clientId**, atomic transaction, audited in the same
  transaction, with a hard **negative-stock guard** and mandatory reason (≥10 chars) for adjustments.
- **Offline outbox** (Dexie/IndexedDB): every movement is written locally first, then synced; retries
  on startup, reconnect, and a 20 s interval; **queue depth shown live in the status strip**. Nothing
  is ever silently dropped.

### Cycle counting
- Sessions: scan location → product → counted quantity → **live variance table**. Counting **never
  mutates stock directly**; closing with "apply" creates an audited **ADJUSTMENT** per non-zero
  variance through the same verified movements path.

### Replenishment / AI Store Manager
- Deterministic **reorder engine** (§12) + bilingual **template reasoning** (no LLM). `POST
  /recommendations/run` generates recommendations; the Replenishment screen shows cards with the
  reasoning and **approve / amend-quantity / reject**. Won't regenerate an in-flight or same-day
  rejected item.
- **Purchase orders:** approving → "Generate purchase orders" groups by supplier (one PO per supplier
  per run), creates `PO-YYYY-####`, builds a **PDF**, and emails it (inert + logged when SMTP is
  unset). *(There is intentionally no in-app PO viewer — it was removed by request; generation stays.)*

### Suppliers
- List + create/edit (ADMIN), lead-time days used by the reorder engine.

### Reports
- `stock-on-hand`, `stock-movements`, `replenishment` — each as **PDF or Excel** (English-only exports).

### Audit log
- ADMIN viewer with filters (entity type/id, actor, action, date) and before/after JSON detail.

### User management
- Create/edit users (ADMIN), **password policy** (≥12 chars + common-password blocklist), role/active/
  password-reset, self-deactivation guard.

### Organization settings (white-label) — `/settings`
- Admin edits org **name (EN/AR), default language, timezone** in-app (audited, ADMIN-only). The
  navigation rail and login screen show the current org's name live. **Rebrand for a new prospect in
  ~30 seconds, no code or database edit.** (Logo upload deferred until MinIO/Docker is wired.)

### Safe delete (Users, Products, Locations, Suppliers)
- The system is **"deactivate, never delete"** for audit integrity. Because there are no foreign keys,
  delete is guarded in application code: a record is **hard-deleted only when nothing references it**,
  otherwise a localised `409` tells you to **deactivate instead**. Every delete writes a `*_DELETE`
  audit entry.
- Guards — **Users:** not self, not the last admin, no movements/decisions/counts/audit-actor rows.
  **Products:** no stock/movement/recommendation/count-line. **Locations:** *subtree cascade* — a store
  room deletes with its empty racks/levels in one action when the whole subtree holds **0 units and no
  history**; any stock (even 1 unit) → blocked ("transfer first"); emptied-but-with-history → "deactivate
  instead". **Suppliers:** not used by any product or PO.
- UI: a reusable `ConfirmDialog` that shows the backend's "deactivate instead" message inline; trash
  actions on the relevant rows/pages.

---

## 10. Design system (`shared/design-tokens/design-tokens.css`)

- **Thesis:** the interface is an **instrument, not a brochure** — dense, quiet, precise. Its identity
  comes from **aviation wayfinding** (segmented position codes, monospaced figures, high contrast).
  The one bold element is the **location designator strip**; everything else is disciplined.
- **Colour:** institutional deep teal primary (light theme `#0B4F5E`), muted gold accent, functional
  status colours (ok/warn/critical). Prohibited: purple/indigo primaries, gradients, glassmorphism,
  large rounded corners, drop shadows on resting elements.
- **Dark theme = "Graphite"** (client choice): neutral warm-grey panels with a teal-cyan primary
  (`--primary #46A9BE`, `--canvas #141518`). Both dark blocks (explicit toggle + `prefers-color-scheme`).
- **Typography:** IBM Plex Sans / Sans Arabic / Mono; tabular figures for all numerals.
- All colours/spacing/radii/fonts come from tokens — **no hardcoded values in components**.

## 11. Bilingual (English + Arabic)
- All strings in `shared/translations/{english,arabic}.json`; CSS **logical properties** throughout
  (`margin-inline-start`, `ms-*`/`me-*`) so RTL works without `left`/`right`.
- Designators, SKUs, barcodes, and PO numbers are **never translated or mirrored** (kept LTR).
- Both themes and both languages are part of "done" for every feature.

---

## 12. The AI — two engines, only one needs the GPU

1. **Replenishment AI (built, works now, no GPU).** Deterministic maths in the backend:
   ```
   dailyUsage     = sum(GOODS_OUT qty, last 30 days) / 30
   leadTimeDemand = dailyUsage × supplier.leadTimeDays
   safetyStock    = dailyUsage × 3
   effectiveROP   = max(reorderPoint, ceil(leadTimeDemand + safetyStock))
   if currentStock ≤ effectiveROP → recommend, suggestedQty rounded up to packSize
   ```
   Reasoning is generated from **templates filled with computed values**, in both languages — it
   cannot hallucinate and is identical regardless of which LLM is configured. This is why the demo's
   AI works in the cloud and on the laptop without any GPU.
2. **Conversational LLM assistant (Phase 2, deferred to the Jetson).** Natural-language questions over
   stock; the model only *phrases* real retrieved data, never generates figures. Swappable model via
   the provider abstraction (Llama for dev → Qwen for prod).

---

## 13. The demos & the multi-entity system

To prove the product is reusable, additional demo entities were provisioned with the entity
provisioner (§14), each a **separate database** switched by editing **`backend/.env`**
(uncomment one labelled block, comment the others, restart backend). Different demos have used
different hierarchy shapes and depths (e.g. a 3-level store-room layout, a 4-level depot/zone/rack/bin
layout, a 5-level base/warehouse/aisle/rack/bin layout) purely to prove the configurable-hierarchy
concept (§8) — none of that is hardcoded, and any shape can be created through the provisioner or
the admin UI.

Because the app's queries are **not** organization-scoped (single-tenant per deployment), each
entity must be a **separate database** — this keeps their data fully isolated. The main
`mizan_inventory` demo database is never touched by other demos.

---

## 14. Productization (running Mizan as a product for any entity)

- **White-label Organization Settings** (§9) — rebrand in-app.
- **New-entity provisioner** — `scripts/create-entity.ps1` + `backend/prisma/entity-seed.ts`:
  ```
  scripts/create-entity.ps1 -Code DEMO2 -NameEn "Second Demo Organization" -Sample
  ```
  One command: creates the DB → applies migrations → applies append-only rules → seeds the org, a
  default Warehouse→Aisle→Shelf hierarchy, units, and an admin + store keeper. With `-Sample` it also
  seeds a neutral catalogue, 30 days of movements, and **pre-seeded replenishment recommendations**
  (using the real backend engine, so they're identical to a live run). Prints the `.env` block + logins.
- **Sidebar demo-logins helper** — the nav rail shows a "Demo logins" button that **reveals** the
  deployment's admin/store-keeper credentials on press. Sourced from env, **development-only** — the
  backend never returns them when `NODE_ENV=production`.

---

## 15. Cloud hosting path (opt-in, non-breaking) — `hosting/`

For showing the demo on **any device** (e.g. the CEO presenting without the laptop). It is deliberately
separate from the on-prem product and **changes nothing about local development**:

- Frontend API base is now `import.meta.env.VITE_API_BASE_URL ?? '/api/v1'` (unset = local proxy,
  unchanged). Backend listens on `PORT ?? API_PORT ?? 3000` bound to `0.0.0.0` (local still `3000`).
- `hosting/firebase.json` serves the React build and **rewrites `/api/**` to Cloud Run** (same origin,
  no CORS). `HOSTING-GUIDE.md` covers two options:
  - **Cloudflare Tunnel** — fastest; exposes the laptop as-is (keeps local AI). Laptop must be on.
  - **Firebase Hosting + Cloud Run + a free serverless Postgres (Neon)** — always-on, near-$0. The
    deterministic AI works there; the LLM assistant stays on-prem.
- **Guardrail:** host **demo data only**, never real client data. The actual deploy runs on the user's
  own Google Cloud / Cloudflare account.

---

## 16. How to run it locally

```bash
# PostgreSQL 18 runs as a Windows service on :5432 (already set up)

# Backend (terminal 1)
npm --prefix backend run start:dev        # → http://localhost:3000/api/v1

# Frontend (terminal 2)
npm --prefix frontend run dev             # → http://localhost:5173

# Reset the demo data if needed
npm --prefix backend run db:seed
```

Open `http://localhost:5173` and log in. The active database is whatever `backend/.env` points at.

---

## 17. Demo logins (per database)

| Database | Admin | Store Keeper |
|---|---|---|
| Main demo (`mizan_inventory`) | `admin@example.com` / `Admin@Mizan2026` | `storekeeper@example.com` / `Store@Mizan2026` |

Any additional entity provisioned via `scripts/create-entity.ps1` gets its own admin/store-keeper
login, printed by the script when it runs. These are **demo credentials only**; each database has
its own users, and real deployments must change them.

---

## 18. DESC security & compliance (built into every layer)

Implemented controls include: TLS termination point (nginx, prod), argon2id password storage +
12-char minimum + blocklist, JWT session management, **account lockout**, role-based access at the
controller, **audit logging of every state change in the same transaction**, **append-only audit +
movement tables enforced by the database**, network segmentation (AI service + DB internal only),
rate-limiting hooks, secure headers (Helmet), secrets in env only, Zod input validation everywhere,
least-privilege DB role. Evidence lives in `documentation/security-compliance/`.

Production-grade versions of a few controls (real TLS, encrypted volumes, backups, Redis session
revocation, rate limiting, MFA enablement, dependency scanning) are part of the hardening track — see §19.

---

## 19. Current status — done / deferred / next

**Done and verified (runs on the laptop today):**
- ✅ Phases 0–3: the full MVP — auth, dashboard, catalogue + import + labels, configurable locations +
  bulk-create, scanning (manual), movements + offline sync, cycle counts, replenishment + PO generation
  + email, suppliers, reports, audit log, users. Bilingual + light/dark.
- ✅ Dark theme "Graphite"; safe delete across master data.
- ✅ Productization: white-label settings, new-entity provisioner, sidebar demo-logins, pre-seeded recs.
- ✅ Reusable demos across multiple differently-shaped entities, all generic.
- ✅ Opt-in cloud-hosting path (config + guide), local workflow untouched.

**Deferred until the NVIDIA Jetson Orin Nano arrives:**
- ⏸️ Production Docker Compose + nginx + TLS + encrypted volumes + backups (also unlocks logo upload).
- ⏸️ Phase 2 AI: Ollama LLM (Qwen), the conversational assistant, demand forecasting.

**Available now, not the GPU's problem (candidate next work):**
- ⬜ **DESC hardening:** Redis JWT denylist/revocation, rate limiting on auth, MFA enablement,
  dependency scanning + evidence docs.
- ⬜ **Quality & polish:** automated test suites (backend/frontend/e2e), accessibility (axe) pass,
  self-hosted IBM Plex fonts.
- ⬜ **Deploy the public demo** (Firebase + Cloud Run + Neon) — runs on the user's cloud account.

---

## 20. Key decisions to remember (the "why")

- **Configuration over code.** Storage shape, catalogue, vocabulary, and branding are data. If you ever
  find yourself writing `if (type === 'STORE_ROOM')`, it belongs in the database instead.
- **Deterministic over generative.** The reorder engine is transparent maths, auditable and identical
  on any model. The LLM only phrases real data; it never invents numbers.
- **Auditability over convenience.** Every state change is logged; audit + movement history is
  append-only and cannot be edited or deleted. Deletion is guarded; deactivation is the default.
- **On-premise is the product.** Cloud hosting is a demo convenience only, kept out of the product
  architecture and switched purely by config.
- **In-app JWT auth, not Keycloak** — five users, on-premise; every DESC control is satisfiable in-app.

---

*This guide summarises the state of the project as of the latest session. For exact, dated detail see
[`PROGRESS.md`](PROGRESS.md); for the binding specification see [`CLAUDE.md`](CLAUDE.md).*
