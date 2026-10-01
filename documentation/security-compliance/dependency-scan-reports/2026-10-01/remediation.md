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
| starlette (8 advisories, via fastapi 0.115.0) | AI service, internal network only (DESC control 11) | fastapi → a release on starlette ≥ 1.3.1 | Medium: re-run the ai-service pytest suite and the assistant checks | 2 |
| react-router — open redirect, SSR deserialisation | Frontend; no SSR in use, redirects are internal | react-router-dom 6 → 7 | Medium: router API changes | 3 |
| pytest | Test tool only, never deployed | pytest 9 | Low | 4 |

Exposure note: the AI service binds to 127.0.0.1 and is reachable only from the backend
(DESC control 11), which lowers, but does not remove, the urgency of the Starlette findings.
