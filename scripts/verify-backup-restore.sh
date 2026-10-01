#!/usr/bin/env bash
# Tested restore (DESC control 17 — "documented and tested restore").
# Takes a fresh encrypted backup, restores it into a throwaway database, checks
# every table's row count against the live database and that the append-only
# rules (control 10) came back, then drops the throwaway database and files a
# dated record under documentation/security-compliance/restore-test-records/.
set -euo pipefail
source "$(dirname "$0")/backup-shared-settings.sh"
require_key_file

STAMP="$(date +%Y%m%d%H%M%S)"
SCRATCH_DB="mizan_restore_check_$STAMP"
SERVER_URL="${PG_URL%/*}"            # same server and credentials, no database
MAINTENANCE_URL="$SERVER_URL/postgres"
SCRATCH_URL="$SERVER_URL/$SCRATCH_DB"
RECORD_DIR="$REPO_ROOT/documentation/security-compliance/restore-test-records"
mkdir -p "$RECORD_DIR"

cleanup() { psql --quiet --dbname="$MAINTENANCE_URL" -c "DROP DATABASE IF EXISTS \"$SCRATCH_DB\";" >/dev/null 2>&1 || true; }
trap cleanup EXIT

started=$(date +%s)
"$(dirname "$0")/backup-database.sh"
BACKUP_FILE="$(ls -t "$BACKUP_DIRECTORY"/mizan-*.dump.enc | head -1)"

psql --quiet --dbname="$MAINTENANCE_URL" -c "CREATE DATABASE \"$SCRATCH_DB\";" >/dev/null
"$(dirname "$0")/restore-database.sh" "$BACKUP_FILE" "$SCRATCH_URL"

count_rows() {
  psql --quiet --tuples-only --no-align --dbname="$1" -c "
    SELECT string_agg(format('%s=%s', t.table_name,
             (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', t.table_name), false, true, '')))[1]::text), ',' ORDER BY t.table_name)
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';"
}
LIVE_COUNTS="$(count_rows "$PG_URL")"
RESTORED_COUNTS="$(count_rows "$SCRATCH_URL")"
RULES="$(psql --quiet --tuples-only --no-align --dbname="$SCRATCH_URL" -c "SELECT count(*) FROM pg_rules WHERE tablename IN ('AuditLog','StockMovement');")"
elapsed=$(( $(date +%s) - started ))

RESULT="PASS"
[ "$LIVE_COUNTS" = "$RESTORED_COUNTS" ] || RESULT="FAIL — row counts differ"
[ "$RULES" -ge 4 ] || RESULT="FAIL — append-only rules missing after restore ($RULES found)"

RECORD="$RECORD_DIR/$(date +%Y-%m-%d)-restore-test.md"
{
  echo "# Restore test — $(date '+%Y-%m-%d %H:%M %Z')"
  echo
  echo "Run by \`scripts/verify-backup-restore.sh\` (DESC control 17)."
  echo
  echo "- **Result: $RESULT**"
  echo "- Backup file: \`$(basename "$BACKUP_FILE")\` ($(du -h "$BACKUP_FILE" | cut -f1), AES-256, checksum verified before restore)"
  echo "- Restored into a throwaway database, dropped afterwards"
  echo "- Append-only rules present after restore: $RULES of 4 (control 10)"
  echo "- Total time, backup plus restore plus checks: ${elapsed}s"
  echo
  echo "| Table | Live rows | Restored rows |"
  echo "|---|---:|---:|"
  paste -d' ' <(echo "$LIVE_COUNTS" | tr ',' '\n') <(echo "$RESTORED_COUNTS" | tr ',' '\n') \
    | awk '{ split($1,a,"="); split($2,b,"="); printf "| %s | %s | %s |\n", a[1], a[2], b[2] }'
} > "$RECORD"
echo "$RESULT — record written to $RECORD"
[ "$RESULT" = "PASS" ]
