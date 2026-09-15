# Local Database Setup (PostgreSQL)

> How the local development database is created and connected. Ref: `CLAUDE.md` §5.
> On the GPU server this same schema is created by Docker + Prisma instead — the schema
> and migrations are identical (§2.3).

## What was set up (2026-07-30)

- **Server:** PostgreSQL 18, running as the Windows service `postgresql-x64-18` on `localhost:5432`.
- **App role:** `mizan` (LOGIN, CREATEDB for Prisma's shadow DB). The application connects as
  this role — **never** as the `postgres` superuser (DESC #19, least privilege).
- **Database:** `mizan_inventory`, owned by `mizan`.
- **Tables:** all 14 domain tables created by Prisma migration `20260730110858_init`.
- **Immutability:** append-only rules applied to `AuditLog` and `StockMovement` (DESC #10).
- **Seeded:** demo dataset loaded (50 products, 60 shelves, 2 users). See `npm run db:seed`.

> **Prisma lives at `backend/prisma/`** (schema, migrations, seed) — the standard layout. Run all
> Prisma commands from the `backend/` folder. See `OPEN-QUESTIONS.md` #6 for why it moved here.
- **Connection string:** in `backend/.env` (git-ignored):
  `DATABASE_URL=postgresql://mizan:mizan_dev_local@localhost:5432/mizan_inventory`
  > `mizan_dev_local` is a throwaway **local-dev** password. Production uses an injected secret.

## Reproduce from scratch

Assumes PostgreSQL is installed and running. `psql` lives at
`C:\Program Files\PostgreSQL\18\bin\psql.exe`.

**1. Create the role and database** (run as the `postgres` superuser — it will prompt for the
superuser password):

```bash
psql -U postgres -h localhost -c "CREATE ROLE mizan WITH LOGIN PASSWORD 'mizan_dev_local' CREATEDB;"
psql -U postgres -h localhost -c "CREATE DATABASE mizan_inventory OWNER mizan;"
```

**2. Create the tables** (from the `backend` folder; reads `DATABASE_URL` from `backend/.env`):

```bash
npm run db:generate
npm run db:migrate
```

**3. Apply the append-only audit rules** (DESC #10):

```bash
psql -U mizan -h localhost -d mizan_inventory -f ../database/migrations/0001_append_only_rules.sql
```

**4. Seed the demo data** (from the `backend` folder):

```bash
npm run db:seed
```

## Useful checks

```bash
# List tables
psql -U mizan -h localhost -d mizan_inventory -c "\dt"

# Confirm the immutability rules are present
psql -U mizan -h localhost -d mizan_inventory -c "SELECT tablename, rulename FROM pg_rules WHERE tablename IN ('AuditLog','StockMovement');"
```

The backend reports the live status at `GET /api/v1/health` → `"database": "connected"`, and the
dashboard's *Backend connection* panel shows the same.

## Reset (wipe and rebuild)

```bash
npx prisma migrate reset   # drops + recreates + re-migrates + runs the seed
# then re-apply the append-only rules (step 3 above)
```

## Next

Database is migrated **and seeded** (50 products, 60 shelves, 2 demo users) and authentication is
live. Next is the Phase 1 inventory core — see [`../THINGS-TO-DO.md`](../THINGS-TO-DO.md).
