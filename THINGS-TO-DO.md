# Things To Do — Mizan Inventory System

> **Your knowledge & tracking document.** Plain-language companion to the technical
> build spec in [`CLAUDE.md`](CLAUDE.md). It tells you, without jargon, what is being
> built, what is done, and what is left.
>
> **This file is kept in sync with `CLAUDE.md`.** Whenever the spec changes, this
> document is updated to match — see the *Change log* at the bottom.
>
> Last synced with `CLAUDE.md`: **2026-07-24**

---

## 1. What we are building, in one paragraph

**Mizan** is an on-premise (no cloud) inventory system for the Dubai Civil Aviation
Authority's store rooms. A store keeper scans a shelf, scans a product, and records
stock going in or out. Stock levels and exact shelf locations update instantly, and
every change is logged permanently. Once a day an **AI Store Manager** looks at stock,
usage and supplier delivery times, and recommends what to reorder — **with its reasoning
written out** — but a human (the Administrator) always approves before anything is
ordered. On approval, the system emails a PDF purchase order to the supplier.

It is bilingual (English + Arabic), works on desktop and tablet, keeps working offline in
the store room, and must satisfy **DESC** (Dubai Electronic Security Center) security rules
at every layer.

> **The system never orders anything by itself. AI recommends; a human approves.** This is
> a hard rule.

---

## 2. Branding — decided

| Item | Decision |
|---|---|
| Product name | **Mizan** (ميزان — Arabic for *balance / scales*) |
| Meaning | Fits inventory: keeping stock "in balance"; also connotes audit/justice |
| Logo | Balance-scale mark in deep teal with a single gold pivot — files in [`brand/`](brand/) |
| Logo variants | `mizan-logo.svg` (full lockup), `mizan-mark.svg` (icon), `mizan-mark-mono.svg` (single-colour) |
| Customer / tenant | Configuration-driven — any organization can be the first customer; the product is resellable |

---

## 3. Where we are right now

**Current phase: Phase 0 — Foundation** (in progress)

### Done ✅
- [x] Repository folder structure created (per spec §3)
- [x] Mizan logo designed (mark, wordmark lockup, monochrome) + placed in `frontend/public/logo/`
- [x] Design tokens — full colour/type/spacing system, light + dark ([`shared/design-tokens/`](shared/design-tokens/))
- [x] Translation scaffold — English + Arabic ([`shared/translations/`](shared/translations/))
- [x] Database schema (Prisma) — all tables incl. the configurable location tree ([`database/schema/`](database/schema/))
- [x] Append-only rule for audit tables (DESC control #10) ([`database/migrations/`](database/migrations/))
- [x] `docker-compose.development.yml` — the laptop stack
- [x] `.env.example` environment template
- [x] DESC control matrix started ([`documentation/security-compliance/`](documentation/security-compliance/))
- [x] **Backend skeleton (NestJS) RUNS** — `/api/v1/health` + `/system/info`, Swagger docs, Helmet, CORS, graceful no-DB mode ([`backend/`](backend/))
- [x] **Frontend skeleton (React/Vite) RUNS** — app shell (rail, top bar, status strip), design tokens wired, dashboard, login screen ([`frontend/`](frontend/))
- [x] **Frontend ↔ Backend connection VERIFIED** — dashboard shows live API data
- [x] **Theme switch (light/dark) + language switch (EN/AR with RTL)** — both work and persist
- [x] **How-to-run guide** ([`HOW-TO-RUN.md`](HOW-TO-RUN.md)) + **upgrades/GPU-readiness analysis** ([`documentation/gpu-readiness-and-upgrades.md`](documentation/gpu-readiness-and-upgrades.md))

- [x] **PostgreSQL connected** — real database wired to the backend (dashboard shows `Database: connected`). Dedicated `mizan` role + `mizan_inventory` db, all 14 tables migrated, append-only audit rules live. See [`database/LOCAL-DATABASE-SETUP.md`](database/LOCAL-DATABASE-SETUP.md)
- [x] **Seed data loaded** — 1 org, 60 shelves (74 nodes), 7 categories, 5 suppliers, 50 products, 58 stock rows, 2 users. Dashboard shows it live. (`npm run db:seed`)
- [x] **Authentication working end to end** — real JWT + argon2id login, account lockout, role guards (ADMIN/STORE_KEEPER), audit logging, protected routes, top-bar user + logout. **Verified in the browser.**

**Demo logins:** `admin@example.com / Admin@Mizan2026` (Administrator) · `storekeeper@example.com / Store@Mizan2026` (Store Keeper)

- [x] **Products & Locations screens (browse)** — products list (search, category filter, low-stock), product detail with "where it's stored", and the location tree with stock rollups. Live data, EN/AR, verified.
- [x] **Barcode input with two options** — **Manual entry** (works now) and **Scan** (blank stub, clearly labelled "device coming soon" — activates when the wireless scanner is bought). Used to look up products and locations.

- [x] **Stock movements** — location-first flow: scan/type a location, then products against it, recording **goods in / out / transfer / adjustment** as audited, transactional movements with a **negative-stock guard**. Verified.
- [x] **Offline outbox** — every movement is saved to the device first (IndexedDB) and syncs when back online; the bottom status strip shows the queue count. A scan is never lost. Verified with a full offline→reconnect round-trip.

- [x] **Admin create/edit + import + labels** — add/edit products (auto internal barcode) and locations, **bulk-create** a whole structure with preview (§5A), **Excel import** with dry-run (never a partial import), and **barcode label printing** (Code128). ADMIN-only. Verified.

- [x] **AI Store Manager (Phase 2)** — daily reorder review with **plain-language reasoning in both languages** (transparent maths, not guesswork), approve/amend/reject, supplier management, **PDF purchase orders** grouped by supplier, and supplier email (works when SMTP is configured; safely inert on the laptop). The AI **recommends; a human approves** — always. Verified.

- [x] **Reports** (PDF + Excel: stock-on-hand, movements, replenishment), **audit-log viewer** (filterable), **user management** (create/edit, password policy, activate/deactivate), and **cycle-count** sessions (scan → variance → apply as adjustments). Verified.

- [x] **Delete (where it's safe)** — a trash button on users, products, locations and suppliers. To protect the audit trail, something is only *deleted* when nothing has ever used it (a test record you just made); if it has any history it can't be deleted and the system asks you to **deactivate** it instead. ADMIN-only, and every delete is written to the audit log. Verified.

> **MVP feature scope (Phases 0–3) is functionally complete on the laptop** — the full loop works: scan stock in/out → daily AI recommendations → approve → PO emailed; plus admin setup, imports, labels, reports, audit and cycle counts, all bilingual + themed.

### Next up ⏳ (production / GPU move — see [gpu-readiness-and-upgrades.md](documentation/gpu-readiness-and-upgrades.md))
- [ ] `docker-compose.production.yml` + nginx config + Dockerfiles; deploy to the GPU server
- [ ] Stage 2 (on the GPU): switch to Qwen, the bilingual **assistant**, demand **forecasting**
- [ ] DESC hardening: Redis token denylist + rate limiting, real TLS, encrypted volumes, backups
- [ ] Test suites (Jest/Vitest/Playwright/pytest) + full accessibility pass + self-hosted IBM Plex fonts
- [ ] AI service skeleton (FastAPI) with a `/health` endpoint
- [ ] Self-hosted IBM Plex font files into `frontend/public/fonts` (currently system fallback)
- [ ] `docker-compose.production.yml`; nginx config + self-signed dev certificate + Dockerfiles
- [ ] Hardening when Redis is available: token denylist + rate limiting on `/auth/*` (DESC #4, #12)

> **Note:** Prisma now lives at `backend/prisma/` (schema/migrations/seed) — the standard layout — instead of `database/schema`, to fix a tooling bug. See `OPEN-QUESTIONS.md` #6.

**Phase 0 is "done" when:** the stack starts, a **seeded user logs in for real**, the shell
renders in both themes and both languages (✅ already), preferences survive a reload (✅ already),
and the location tree renders from configuration (needs the database).

> **What runs today:** frontend + backend, connected, bilingual, themed. See
> [`HOW-TO-RUN.md`](HOW-TO-RUN.md). **What's next & the full GPU-move plan:** see
> [`documentation/gpu-readiness-and-upgrades.md`](documentation/gpu-readiness-and-upgrades.md).

---

## 4. The whole plan, phase by phase

Think of it as five stages. We do them in order; we don't start a later one until the
earlier one is tested.

### Phase 0 — Foundation *(current)*
Get the skeleton standing: folders, database, security basics, the visual shell, login,
themes and languages. Nothing "does" inventory yet — but everything it will stand on is here.

### Phase 1 — Inventory core
The heart of the system.
- **Admin sets up the structure:** define the storage shape (store room → rack → level),
  bulk-create shelves with a preview, print barcode labels, set up product categories,
  units, and custom product fields.
- **Products & stock:** add products, import them from Excel (with a dry-run check first),
  generate internal barcodes, print labels.
- **Scanning & movements:** the barcode scanner listener, the big **location designator
  strip**, all five movement types (goods in, goods out, transfer, cycle count, adjustment),
  and **offline scanning** that syncs when the connection returns.
- **Done when:** an admin can build a hierarchy from scratch and a store keeper can scan and
  record every movement type — online *and* offline — with correct stock and a full audit trail.
- **Product test:** configure a *differently shaped* hierarchy (e.g. warehouse → aisle → bin)
  and confirm everything still works with zero code changes.

### Phase 2 — AI Store Manager
- The daily review job, the reorder calculator (transparent maths, not guesswork), the
  plain-language reasoning in both languages, the approve/amend/reject screen, supplier
  management, PDF purchase orders, and emailing them to suppliers.
- **Done when:** the daily job produces explained recommendations, an admin approves one,
  and a correct PO email reaches the supplier.

### Phase 3 — Dashboard, reporting, hardening
- Dashboard, PDF/Excel reports with charts, the audit-log viewer, user management,
  cycle-count sessions with variance reports, **all DESC controls verified with evidence
  written**, a full accessibility pass, tablet layouts, and the user guides.
- **Done when:** MVP is complete, tested, accessible, DESC evidence filed, and deployed.

### Stage 2 — after the client accepts the MVP
Move to the real server, switch the AI model from Llama (dev) to Qwen (production), run the
Arabic-quality check, add demand forecasting, seasonal logic, and the mobile app.

### Product phase — later, sold separately
Multi-customer isolation, customer onboarding, white-labelling, licensing. **Not built now**
— but the database already carries an `organizationId` on every table so this won't need a
painful rewrite later.

---

## 5. Rules I must follow on *every* task

These are the things that are easy to get wrong and that the spec insists on. They apply to
every feature, not just once.

1. **Both languages, always.** Every piece of text goes through the translation files —
   no English typed directly into a screen. Arabic must be complete, not half-done, and the
   layout must flip correctly right-to-left.
2. **Both themes, always.** Light and dark. A bug in Arabic dark mode is still a bug.
3. **Only design tokens.** Every colour, size, spacing, radius and font comes from the token
   file. No arbitrary values.
4. **Configuration, not code.** Never hardcode "store room", "rack", "level", a depth of
   three, or the word for a shelf. A different customer must be able to model warehouses and
   bins through the screen, with no developer. If I'm about to write `if type == "STORE_ROOM"`,
   I stop — that's a setting, not code.
5. **Everything that changes state is logged** — in the same database transaction, permanently.
6. **DESC evidence as I go.** Each security control gets its written evidence *when it's built*,
   not scraped together at the end. Filed under `documentation/security-compliance/`.
7. **AI explains, never decides.** The reorder maths is transparent and reproducible; the AI
   writes the explanation but never invents numbers and never places an order.
8. **Offline never loses a scan.** Every scan is queued locally first, then synced in order.
9. **Stock can never go negative.** Adjustments need a reason (10+ characters).
10. **Good names.** Files and folders say what they are — no `utils`, `helpers`, `misc`, `calc`.

**A feature isn't "done" until:** it works in EN + AR, light + dark, is keyboard-accessible,
passes the accessibility checker, renders at 1440/1024/768px, uses only tokens, handles errors
in the user's language, has loading + empty states, has tests, writes audit records, has its
DESC evidence updated, follows the naming rules, works against a differently-shaped hierarchy,
and `PROGRESS.md` is updated.

---

## 6. Key facts worth remembering

- **Two environments, one codebase.** We build on a laptop now; the real server comes later.
  Moving over changes *only configuration* — never code. The AI model is swapped by changing
  one setting (`LANGUAGE_MODEL_PROFILE`), not by editing features.
- **Dev AI model writes poor Arabic.** That's expected on the laptop (Llama 3.2 3B). It's fine
  for testing the *workflow*; a "development model" badge marks unverified Arabic answers, and
  before the client demo we re-test on the real model (Qwen) and check Arabic quality. This only
  affects the chat assistant — **not** the reorder reasoning, which is template maths and identical
  on both models.
- **No cloud, ever, at runtime.** The only outbound traffic allowed is SMTP to email suppliers.
- **Scale is small, standards are high.** ~50 products, ~60 shelf locations, up to 5 users. This
  is a government system of record — correctness and auditability matter more than speed.
- **Scanner = keyboard.** The barcode scanner types the code and hits Enter, very fast. We tell it
  apart from a human by typing speed. No focused text box required.

---

## 7. Open questions / decisions to confirm

Tracked in [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md). When something is genuinely unclear, we take
the more cautious option and note it there rather than stalling.

---

## Change log (of this document)

| Date | Change |
|---|---|
| 2026-07-24 | Created. Reflects `CLAUDE.md` as of this date. Recorded Mizan branding + logo, Phase 0 progress. |
| 2026-07-24 | Backend + frontend now RUN and are connected (verified); theme + EN/AR RTL switching working. Added HOW-TO-RUN.md and GPU-readiness/upgrades analysis. |
| 2026-07-30 | PostgreSQL 18 connected to the backend (verified). Prisma schema fixed + migrated (14 tables); dedicated `mizan` role/db; append-only audit rules live. |
| 2026-07-31 | Seeded demo data (50 products, 60 shelves, etc.) and built full JWT + argon2id authentication with lockout, role guards and audit logging — verified end to end. Prisma moved to `backend/prisma/`. |
| 2026-07-31 | Phase 1 browse screens: products (list/detail) + locations (tree with rollups), with a two-mode barcode input (manual works now; scan stubbed until the device is bought). Verified in EN + AR. |
| 2026-07-31 | Stock movements (in/out/transfer/adjustment) via the location-first flow — audited, transactional, negative-stock-safe — plus a Dexie offline outbox with live queue depth. Verified incl. a full offline→reconnect round-trip. |
| 2026-08-01 | Admin CRUD: product create/edit (auto internal barcode), location add + bulk-create with preview, Excel import (dry-run, never-partial), barcode label printing (Code128). ADMIN-gated. Verified. |
| 2026-08-01 | AI Store Manager (Phase 2): deterministic reorder engine + bilingual reasoning, recommendation approve/amend/reject, supplier management, PDF purchase orders grouped by supplier, SMTP dispatch. Python ai-service skeleton (scheduler + model-provider abstraction). Verified. |
| 2026-08-01 | Phase 3: reports (PDF+Excel), audit-log viewer, user management (password policy), cycle-count sessions (scan→variance→apply as adjustments). MVP feature scope (Phases 0–3) functionally complete on the laptop. Verified. |
