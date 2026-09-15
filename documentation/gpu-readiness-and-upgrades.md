# Mizan — Upgrades Needed & GPU-Server Readiness Analysis

> Prepared 2026-07-24. Companion to [`THINGS-TO-DO.md`](../THINGS-TO-DO.md) and
> [`PROGRESS.md`](../PROGRESS.md). Purpose: give you a complete picture of what exists,
> what must still be built/upgraded, and exactly what changes when you move to the GPU
> server — so nothing is a surprise.

---

## 1. Executive summary

**What runs today (verified on this laptop, natively, no Docker):**
- ✅ **Backend** (NestJS) live on `http://localhost:3000/api/v1` — health + system endpoints, Swagger docs, Helmet security headers, CORS, graceful "no database" mode.
- ✅ **Frontend** (React/Vite) live on `http://localhost:5173` — full application shell (navigation rail, top bar, status strip), the signature location-designator strip, dashboard.
- ✅ **Frontend ↔ Backend confirmed connected** — the dashboard shows live data pulled from the API ("Backend connection established", live uptime counter).
- ✅ **Bilingual EN/AR with correct RTL** and **light/dark theming**, both switch live and persist.

**Blunt status:** this is a **working skeleton / vertical slice**, not the finished product. It proves the architecture, design system, and the frontend–backend link are sound. The **business features, the database, the AI service, and most DESC security controls are not built yet.** The list below is the road from here to a production system.

---

## 2. What is NOT yet built (the real work remaining)

### A. Data layer — *the biggest immediate gap*
The backend currently runs **without a database** (it degrades gracefully). To do anything real:
- [ ] Stand up **PostgreSQL 16** and run the Prisma migrations (`schema.prisma` is written and ready).
- [ ] Apply the **append-only rules** migration (already written) for the audit tables.
- [ ] Write and run the **seed script** (demo org, `STORE_ROOM > RACK > LEVEL`, 60 locations, 50 demo products).
- [ ] Build the repository/service layer so products, locations, stock and movements actually persist.
- **Redis** (sessions/queues) is also needed for auth + background jobs.

### B. Authentication & access control (currently the login screen is cosmetic)
- [ ] Real **JWT login** (access + refresh), **argon2id** password hashing, password rules + blocklist.
- [ ] **Role guards** (ADMIN / STORE_KEEPER) enforced at the controller.
- [ ] Account **lockout**, **idle timeout**, **TOTP MFA** (built, disabled until certification).
- [ ] Token revocation via Redis denylist.

### C. Inventory core (Phase 1 — the heart of the app)
- [ ] Location-type & location-tree administration + **bulk create with preview**.
- [ ] Product catalogue, categories, units, custom attributes; **Excel import with dry-run**.
- [ ] **Barcode label** generation + printing; internal barcode generation.
- [ ] **Barcode scanning listener** (keyboard-wedge, speed detection) + the location-first flow.
- [ ] All five **stock movement** types with correct stock maths + audit records.
- [ ] **Offline outbox** (IndexedDB) with sync on reconnect.

### D. AI Store Manager (Phase 2) — *not started; this is what the GPU is for*
- [ ] The **AI service** (FastAPI) itself — not yet built.
- [ ] Daily review job, deterministic reorder calculator, bilingual reasoning generator.
- [ ] Recommendation approve/amend/reject, supplier management, **PDF purchase orders**, SMTP email.
- [ ] The **language-model provider abstraction** (Llama ↔ Qwen by config) and the assistant.

### E. Dashboard, reporting, hardening (Phase 3)
- [ ] Real dashboard data, PDF/Excel reports, audit-log viewer, user management, cycle counts.

### F. Quality gates (required for "done")
- [ ] **Tests** (Jest / Vitest / Playwright / pytest) — none yet.
- [ ] **Accessibility** pass (axe, WCAG 2.1 AA) — required and is DESC evidence.
- [ ] **Font hosting** — self-hosted IBM Plex files are referenced but not yet placed in `frontend/public/fonts` (currently falls back to system mono/sans).

---

## 3. DESC security controls — current status

Most controls are **designed but not yet active**. Full detail in
[`security-compliance/control-implementation-matrix.md`](security-compliance/control-implementation-matrix.md). Highlights of what still must be implemented before the system is DESC-ready:

| Area | Status now | Needed |
|---|---|---|
| Secure headers (Helmet) | ✅ active in backend | Tighten CSP for production |
| Network segmentation | ◐ defined in compose | Enforced once running under Docker on the server |
| Password storage / sessions / lockout / MFA | ☐ | Build with the auth module (Section 2B) |
| Audit logging in every transaction | ◐ table + rules ready | Wire into every state change |
| Encryption in transit (TLS) | ◐ | Real certificate at nginx on the server |
| Encryption at rest | ☐ | Encrypted DB volume + MinIO SSE on the server |
| Rate limiting on `/auth/*` | ☐ | Build with auth |
| Backup & tested restore | ☐ | Server procedure + evidence |
| Dependency scanning in CI | ☐ | `pnpm audit` / `pip-audit` pipeline |

---

## 4. Moving to the GPU server — what actually changes

Per the build spec (§2), the golden rule is: **the code does not change — only configuration.**
Here is the concrete checklist for the move.

### 4.1 Configuration-only switches (no code changes)
- [ ] Use `docker-compose.production.yml` instead of the development one *(needs to be written — mirror of the dev file with the differences below)*.
- [ ] **Language model:** set `LANGUAGE_MODEL_PROFILE=qwen-production` (from `llama-development`). One variable. The GPU runs **Qwen 2.5 14B** via Ollama on GPU instead of Llama 3.2 3B on CPU.
- [ ] **TLS:** install the **real certificate** at nginx (replacing the self-signed dev cert), enable HSTS.
- [ ] **Secrets:** injected at deploy time, never in the repo (`JWT_SECRET`, DB password, MinIO keys, SMTP credentials).
- [ ] **Encrypted volumes** for PostgreSQL and MinIO.
- [ ] **Data:** migrate the real customer's data in place of seed/demo data.
- [ ] Point `SMTP_*` at the customer's on-premise mail relay.

### 4.2 What the GPU server needs installed
- [ ] **Docker + Docker Compose** (this is where Docker lives — not the laptop).
- [ ] **NVIDIA GPU driver + NVIDIA Container Toolkit** (so the Ollama container can use the GPU).
- [ ] Pull the production model once: `ollama pull qwen2.5:14b-instruct-q4_K_M`.
- [ ] Enough VRAM for the 14B Q4 model (≈ 10–12 GB) plus headroom.

### 4.3 The one mandatory gate before showing the AI to the client (§2.2)
- [ ] **Language-model validation:** the dev model (Llama) writes **poor Arabic** — this is expected. Before UAT, re-run the assistant test suite against **Qwen** and manually review Arabic quality, then record the result in `security-compliance/language-model-validation.md`.
- Note: this affects **only the chat assistant**. The reorder **reasoning** is template maths and is identical on both models — procurement is unaffected.

### 4.4 What must be built before the move is meaningful
The GPU only matters once the **AI service exists** (Section 2D) and there is **real data** in a **real database** (Section 2A). Recommended: complete Phases 0–1 (data + inventory core) and at least the AI service skeleton **on the laptop first**, then move to the GPU for the model upgrade and hardening.

---

## 5. Recommended order of work

1. **Finish the data layer** — Postgres + Prisma migrations + seed (unlocks everything real).
2. **Real authentication + role guards** (DESC controls B).
3. **Inventory core** (Phase 1): locations, products, scanning, movements, offline.
4. **AI service skeleton** + reorder calculator + reasoning (Phase 2 logic — still on Llama/CPU).
5. **Reports, dashboard, cycle counts, user management** (Phase 3).
6. **Tests + accessibility + DESC evidence** throughout, not at the end.
7. **Write `docker-compose.production.yml`** and containerise.
8. **Move to the GPU server** → switch to Qwen, real TLS, encrypted volumes, run the Arabic gate.

> Everything in steps 1–6 can be done on this laptop. The GPU is only required for step 8.

---

## 6. Bottom line

- The **foundation and the frontend↔backend pipeline are proven and working today.**
- The move to GPU is **low-risk by design** — it is configuration, not rewriting — **but** it is only worthwhile after the database, authentication, inventory features and the AI service are built. Those are the real upgrades ahead, and they can all be built here before the server arrives.
