#!/bin/sh
# DESC #19 — least privilege for the database (CLAUDE.md §11.1).
# Runs once, when the production PostgreSQL volume is first created
# (/docker-entrypoint-initdb.d). The superuser created by the image is used only
# here; the application never connects as it.
#
#   mizan_owner   owns the schema; used only by the one-shot `migrate` service
#   mizan_app     what the API uses at runtime: read and write rows, nothing else —
#                 cannot create or drop tables, cannot change the append-only rules,
#                 and cannot UPDATE or DELETE audit or movement rows at all
#   mizan_backup  read-only (pg_read_all_data), for scripts/backup-database.sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v owner_password="$MIZAN_OWNER_PASSWORD" \
  -v app_password="$MIZAN_APP_PASSWORD" \
  -v backup_password="$MIZAN_BACKUP_PASSWORD" \
  -v DBNAME="$POSTGRES_DB" <<'SQL'
CREATE ROLE mizan_owner LOGIN PASSWORD :'owner_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE mizan_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE mizan_backup LOGIN PASSWORD :'backup_password' NOSUPERUSER NOCREATEDB NOCREATEROLE IN ROLE pg_read_all_data;

ALTER DATABASE :"DBNAME" OWNER TO mizan_owner;
REVOKE ALL ON DATABASE :"DBNAME" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"DBNAME" TO mizan_app, mizan_backup;

ALTER SCHEMA public OWNER TO mizan_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO mizan_app;

-- Tables and sequences the owner creates later (via migrations) are usable by the app.
ALTER DEFAULT PRIVILEGES FOR ROLE mizan_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mizan_app;
ALTER DEFAULT PRIVILEGES FOR ROLE mizan_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO mizan_app;
SQL
