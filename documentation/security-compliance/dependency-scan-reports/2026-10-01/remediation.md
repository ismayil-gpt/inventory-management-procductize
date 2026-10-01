# Remediation plan — scan of 2026-10-01

Applied the same day: every non-breaking fix (`npm audit fix` in frontend and backend —
brace-expansion, file-type, qs, @nestjs/common patch, part of react-router). Type checks, the
19 backend tests and the production frontend build pass afterwards.

Still open: each needs a major-version upgrade, so each is its own change with its own testing.

| Finding (runtime) | Affects | Fix | Risk of the upgrade | Priority |
|---|---|---|---|---|
| ~~nodemailer — SMTP command injection, mail to unintended domain~~ | Supplier PO email (the only outbound traffic) | **Done 2026-10-01:** nodemailer 6 → 10, @types/nodemailer 8 | Verified by `email.service.spec.ts` (real SMTP round trip with PDF attachment) | ✔ |
| ~~multer — denial of service~~ | Excel product import upload | **Done 2026-10-01:** multer 2.4.0 via @nestjs/platform-express 11 | Import dry run verified on the new stack | ✔ |
| ~~@nestjs/core, platform-express, swagger, config — injection, body-parser DoS, lodash~~ | Whole API | **Done 2026-10-01:** NestJS 10 → 11.2.7 (core advisory fixed from 11.1.18), config 4, swagger 11.4.7 | 36/36 tests; all 29 read endpoints identical to v10 (status and shape); writes, idempotent replay, error shape and upload verified | ✔ |
| exceljs → uuid bounds check (moderate) | Excel exports and import | **Accepted, not exploitable here:** the flaw is in uuid's v3/v5/v6 with a caller-supplied buffer; exceljs 4.4.0 (latest) only calls `v4()`. Recheck when exceljs updates uuid | — | accepted |
| ~~starlette (8 advisories, via fastapi 0.115.0)~~ | AI service | **Done 2026-10-01:** fastapi 0.142.2, starlette 1.7.0 (pinned) | 44/44 pytest; service started, assistant answered live through the backend with 8 source records | ✔ |
| ~~react-router — open redirect, SSR deserialisation~~ | Frontend | **Done 2026-10-01:** react-router-dom 6 → 7.18.4 | Type check, production build, browser walk of all 16 menu links, URL tabs, search, back, redirects, sign-out | ✔ |
| ~~pytest~~ | Test tool only | **Done 2026-10-01:** pytest 9.1.1, pytest-asyncio 1.4.0 | 44/44 | ✔ |

Exposure note: the AI service binds to 127.0.0.1 and is reachable only from the backend
(DESC control 11), which lowers, but does not remove, the urgency of the Starlette findings.

## After the 2026-10-01 upgrades

Runtime high/critical: **0** in backend, frontend and AI service. Remaining moderate:
- js-yaml via @nestjs/swagger: only the API docs page uses it, and that page is disabled in production
  (`SWAGGER_ENABLED`, DESC #13). Accepted for development.
- uuid via exceljs: accepted, see above.
- NestJS 12 is available but its logging adapter (nestjs-pino 5) needs Node 22; this board runs
  Node 20. NestJS 11 already carries every security fix found. Move to 12 together with Node 22 in
  production packaging (OPEN-QUESTIONS #22).
