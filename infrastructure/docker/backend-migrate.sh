#!/bin/sh
# Schema changes, run by the one-shot `migrate` service as the schema owner —
# never by the API itself, which connects with the narrower mizan_app role (DESC #19).
set -eu
npx prisma migrate deploy --schema=prisma/schema.prisma
# Append-only rules live outside Prisma's migrations folder (DESC #10).
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database-migrations/0001_append_only_rules.sql
if [ -f database-migrations/after-migrations-privileges.sql ]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database-migrations/after-migrations-privileges.sql
fi
echo "Migrations and database controls applied."
