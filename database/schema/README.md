# Prisma schema location

The Prisma schema, migrations and seed now live with the code that consumes them, at
`backend/prisma/` (the standard Prisma layout). This avoids a monorepo module-resolution
problem where Prisma could not locate `@prisma/client` from a top-level schema folder and
kept auto-installing a stray client at the repository root.

- Schema:     `backend/prisma/schema.prisma`
- Migrations: `backend/prisma/migrations/`
- Seed:       `backend/prisma/seed.ts`  (run: `npm run db:seed` from `backend/`)

The append-only audit rules remain an ops script at `database/migrations/0001_append_only_rules.sql`.
