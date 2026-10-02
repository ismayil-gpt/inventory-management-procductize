#!/usr/bin/env bash
# Rebuilds the DEMO database from nothing (OPEN-QUESTIONS #14).
#
# Why a full rebuild: the audit log and stock movements are append-only (DESC #10),
# so re-seeding an existing database leaves earlier movements pointing at products
# that no longer exist. The only clean way is a fresh database.
#
# What it does: refuses in production → encrypted backup of the current database →
# drops and recreates it → applies migrations and the append-only rules → seeds the
# demo data (including the AI service account from SERVICE_ACCOUNT_*) → checks there
# are no orphaned rows. The running backend reconnects by itself.
#
#   scripts/reset-demo-database.sh --yes
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

[ "${1:-}" = "--yes" ] || { echo "This deletes ALL data in the demo database and reloads demo data. Run with --yes to confirm."; exit 2; }

# Settings: backend/.env first, then the shared development file (service account etc.).
set -a
[ -f .env.development ] && . ./.env.development
[ -f backend/.env ] && . ./backend/.env
set +a
if [ "${NODE_ENV:-development}" = "production" ]; then
  echo "Refusing: NODE_ENV=production. This script is for the demo database only." >&2
  exit 3
fi
DB_URL="${DATABASE_URL%%\?*}"
DB_NAME="${DB_URL##*/}"
SERVER_URL="${DB_URL%/*}"
case "$DB_NAME" in
  *prod*|*production*) echo "Refusing: database name '$DB_NAME' looks like production." >&2; exit 3;;
esac

echo "1/5 Encrypted backup of the current database"
DATABASE_URL="$DB_URL" scripts/backup-database.sh

echo "2/5 Recreating $DB_NAME"
psql -v ON_ERROR_STOP=1 --quiet --dbname="$SERVER_URL/postgres" >/dev/null <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
DROP DATABASE "$DB_NAME";
CREATE DATABASE "$DB_NAME";
SQL

echo "3/5 Migrations and append-only rules"
(cd backend && DATABASE_URL="$DB_URL" npx prisma migrate deploy --schema=prisma/schema.prisma >/dev/null)
psql -v ON_ERROR_STOP=1 --quiet --dbname="$DB_URL" -f database/migrations/0001_append_only_rules.sql
psql -v ON_ERROR_STOP=1 --quiet --dbname="$DB_URL" -f database/production/after-migrations-privileges.sql

echo "4/5 Demo data"
(cd backend && DATABASE_URL="$DB_URL" npx tsx prisma/seed.ts | tail -6)

echo "5/5 Checks"
psql --quiet --tuples-only --no-align --dbname="$DB_URL" <<'SQL'
SELECT 'stock movements: ' || count(*) || ', orphaned: ' || count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.id = m."productId")) FROM "StockMovement" m;
SELECT 'append-only rules: ' || count(*) FROM pg_rules WHERE tablename IN ('AuditLog', 'StockMovement');
SELECT 'users: ' || string_agg(email, ', ' ORDER BY email) FROM "User";
SQL
echo "Demo database rebuilt."
