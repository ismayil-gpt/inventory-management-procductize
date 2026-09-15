# Mizan — Inventory Intelligence

**Mizan** (ميزان — Arabic for *balance / scales*) is an on-premise, DESC-compliant, bilingual
(English + Arabic) inventory management system for store rooms and warehouses. Built as a
reusable product — storage structure, catalogue and vocabulary are configuration, not code, so
any organization can model its own hierarchy through the interface.

> **Read [`CLAUDE.md`](CLAUDE.md) before writing any code.** It is the binding build
> specification. For a plain-language overview and task tracker see
> [`THINGS-TO-DO.md`](THINGS-TO-DO.md); for status see [`PROGRESS.md`](PROGRESS.md).

## What it does
Store keepers scan a shelf then a product to record stock movements; stock and exact location
update in real time and every change is logged immutably. A daily **AI Store Manager** reviews
stock, consumption and supplier lead times and recommends reorders **with its reasoning** — a
human always approves before any purchase order is generated and emailed to the supplier.

## Architecture
| Layer | Stack |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind (custom tokens), TanStack Query/Table, react-i18next |
| Backend | NestJS 10, Prisma, PostgreSQL 16, Redis + BullMQ, Passport JWT (argon2id) |
| AI service | FastAPI + Pydantic, APScheduler, Ollama (local LLM), statsmodels |
| Infra | Docker Compose, nginx (TLS), MinIO object storage — fully on-premise, no cloud |

## Running (development, on a laptop)
> Full skeleton is being built during Phase 0. Once the service skeletons and Dockerfiles land:

```bash
cp infrastructure/environment-templates/.env.example .env.development
# edit .env.development and set the CHANGEME secrets
docker compose -f docker-compose.development.yml up --build
```

Then pull the development language model once the stack is up:

```bash
docker compose -f docker-compose.development.yml exec ollama ollama pull llama3.2:3b-instruct-q4_K_M
```

## Environments
Two environments, **one codebase**. The laptop (`docker-compose.development.yml`, Llama 3.2 on CPU,
self-signed TLS) and the on-premise server (`docker-compose.production.yml`, Qwen 2.5 on GPU, real
TLS) differ **only by configuration** — never by code. See `CLAUDE.md` §2.

## Repository layout
```
frontend/        React web app (desktop + tablet)
backend/         NestJS API and business logic
ai-service/      Python AI, forecasting and assistant
shared/          design-tokens · translations · data-contracts
database/        Prisma schema · migrations · seed-data
infrastructure/  nginx · docker · environment-templates
documentation/   security-compliance (DESC) · api-reference · guides
brand/           Mizan logo assets
scripts/         barcode generation · Excel import · first-admin creation
```

## Compliance
Every layer must satisfy **DESC** (Dubai Electronic Security Center). Evidence is written as each
control is built, under [`documentation/security-compliance/`](documentation/security-compliance/).

## License / status
Proprietary — Grow Plus Technologies. Currently in **Phase 0 (Foundation)**.
