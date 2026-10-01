# Remediation plan — scan of 2026-10-01

Applied the same day: every non-breaking fix (`npm audit fix` in frontend and backend —
brace-expansion, file-type, qs, @nestjs/common patch, part of react-router). Type checks, the
19 backend tests and the production frontend build pass afterwards.

Still open: each needs a major-version upgrade, so each is its own change with its own testing.

| Finding (runtime) | Affects | Fix | Risk of the upgrade | Priority |
|---|---|---|---|---|
| ~~nodemailer — SMTP command injection, mail to unintended domain~~ | Supplier PO email (the only outbound traffic) | **Done 2026-10-01:** nodemailer 6 → 10, @types/nodemailer 8 | Verified by `email.service.spec.ts` (real SMTP round trip with PDF attachment) | ✔ |
| multer — denial of service | Excel product import upload | multer 1 → 2 (via @nestjs/platform-express) | Medium: comes with the NestJS upgrade | 2 |
| @nestjs/core, platform-express, swagger, config — injection, body-parser DoS, js-yaml and lodash in swagger | Whole API | NestJS 10 → current major | High: framework upgrade; full regression run needed | 2 |
| exceljs → uuid bounds check | Excel exports and import | exceljs upgrade or replace | Medium | 3 |
| ~~starlette (8 advisories, via fastapi 0.115.0)~~ | AI service | **Done 2026-10-01:** fastapi 0.142.2, starlette 1.7.0 (pinned) | 44/44 pytest; service started, assistant answered live through the backend with 8 source records | ✔ |
| react-router — open redirect, SSR deserialisation | Frontend; no SSR in use, redirects are internal | react-router-dom 6 → 7 | Medium: router API changes | 3 |
| ~~pytest~~ | Test tool only | **Done 2026-10-01:** pytest 9.1.1, pytest-asyncio 1.4.0 | 44/44 | ✔ |

Exposure note: the AI service binds to 127.0.0.1 and is reachable only from the backend
(DESC control 11), which lowers, but does not remove, the urgency of the Starlette findings.
