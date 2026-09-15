# DESC Control Implementation Matrix — Mizan

> **Mandatory across every layer.** Ref: `CLAUDE.md` §11. A control is **not done until
> its evidence entry exists.** Update this file whenever a control lands.
>
> Status legend: ☐ not started · ◐ in progress · ☑ implemented (dev) · ✔ verified (with evidence)
> Environment note: in development some controls are implemented but not production-grade
> (self-signed cert, unencrypted host volume, local backups) — see §11.2. The gap is recorded,
> the control is **never removed**.

Last updated: **2026-09-02** (Stage 2: AI assistant + demand forecasting on the Jetson)

| # | Control | Status | Where / evidence |
|---|---------|:---:|------------------|
| 1 | Encryption in transit (TLS at nginx, HSTS, TLS 1.2 min) | ◐ | `docker-compose.development.yml` (nginx 443); nginx conf + dev cert pending → `encryption-configuration.md` |
| 2 | Encryption at rest (encrypted PG volume, MinIO SSE) | ◐ | Volumes defined; encryption is a prod-env gap in dev (§11.2) |
| 3 | Password storage (argon2id, ≥12 chars, blocklist) | ✔ | `@node-rs/argon2` (argon2id). **Policy enforced** on user create/update — `user.schema.ts` requires ≥12 chars + a common-password blocklist. Verified (weak password → 400) |
| 4 | Session management (JWT 15m/refresh 7d, rotated, revocable) | ◐ | Access 15m + refresh 7d + `/auth/refresh` live (`authentication.service.ts`); server-side revocation needs Redis denylist |
| 5 | Account lockout (5 attempts → 15m lock, audited) | ☑ | Enforced in `authentication.service.ts` (`ACCOUNT_LOCKOUT_ATTEMPTS`/`_MINUTES`); `ACCOUNT_LOCKED` audit row written |
| 6 | Idle timeout (30m → re-auth) | ◐ | `SESSION_IDLE_TIMEOUT_MINUTES` in env; frontend idle enforcement pending |
| 7 | Multi-factor (TOTP built, `MFA_ENABLED=false`) | ◐ | Schema field `mfaSecret` present; `MFA_ENABLED=false` in `.env.example` |
| 8 | Access control (role guards at controller, never client-trusted) | ☑ | `JwtAuthGuard` + `RolesGuard` + `@Roles()`; verified store keeper → 403 on `/users` |
| 9 | Audit logging (every state change writes `AuditLog` in same tx) | ☑ | Auth events audited; stock movements write `STOCK_*` `AuditLog` (with before/after) **inside the same `$transaction`** (`stock-movements.service.ts`). Pattern to reuse for all future state changes. Extended to the assistant: every `POST /assistant/query` writes an `ASSISTANT_QUERY` audit row (`assistant.service.ts`) — not a state change, but every question a user asks the AI is logged like any other action |
| 10 | Log immutability (PG rule blocks UPDATE/DELETE) | ☑ | **Applied to live DB** — 4 rules on `AuditLog`/`StockMovement`, verified via `pg_rules`. `database/migrations/0001_append_only_rules.sql` |
| 11 | Network segmentation (AI + DB unreachable from outside Docker net) | ◐ | `docker-compose.development.yml` — only nginx published; rest `expose` only. **On the Jetson (native run, no Docker yet)**: ai-service binds `127.0.0.1:8000` only, reachable solely from the backend on the same host; not proxied through nginx or exposed on the LAN. Equivalent isolation today, but not yet the Docker-network form the control describes — revisit when production packaging (deferred, see `PROGRESS.md`) lands |
| 12 | Rate limiting on `/auth/*` | ☐ | Backend auth module (pending) |
| 13 | Secure headers (Helmet, strict CSP, no inline scripts) | ☑ | `backend/src/main.ts` — Helmet active; strict CSP tightening pending |
| 14 | Secrets management (env only, `.env*` git-ignored) | ☑ | `.env.example` committed; real `.env*` git-ignored (`.gitignore` pending) |
| 15 | Log hygiene (no PII; user IDs only) | ☐ | Pino config (pending) |
| 16 | Dependency scanning (`pnpm audit`, `pip-audit` in pipeline) | ☐ | CI pipeline (pending) → `dependency-scan-reports/` |
| 17 | Backup & recovery (automated encrypted backups, tested restore) | ☐ | `backup-and-recovery-procedure.md` (pending); local-only in dev (§11.2) |
| 18 | Data residency (all data on-premise) | ☑ | No cloud services; only outbound is SMTP (`CLAUDE.md` §1, §16) |
| 19 | Least privilege (runtime DB role, no superuser) | ◐ | App connects as dedicated `mizan` role (not `postgres`), verified live; CREATEDB still granted for dev shadow DB — tighten for production |
| 20 | Input validation (Zod at every boundary; Prisma parameterised) | ☑ | `ZodValidationPipe` on auth endpoints; Prisma (parameterised) live. Shared `data-contracts/` package still to be extracted |

## Evidence files to produce (as controls land)
- [ ] `data-flow-diagram.md`
- [ ] `encryption-configuration.md`
- [ ] `access-control-model.md`
- [ ] `audit-logging-specification.md`
- [ ] `backup-and-recovery-procedure.md`
- [ ] `dependency-scan-reports/` (dated)
- [ ] `accessibility-conformance-report.md` (WCAG 2.1 AA)
- [x] `language-model-validation.md` (§2.2 Arabic quality gate — **result: does not yet pass**, see file)
- [x] `control-implementation-matrix.md` (this file)
