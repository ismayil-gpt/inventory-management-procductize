#!/usr/bin/env bash
# Restore an encrypted backup (DESC control 17).
#   restore-database.sh <backup.dump.enc> <target-database-url> [--confirm-overwrite-live]
# The checksum is verified before anything is touched. Restoring over the live
# database requires --confirm-overwrite-live; restore into a fresh database first
# when in doubt.
set -euo pipefail
source "$(dirname "$0")/backup-shared-settings.sh"
require_key_file

BACKUP_FILE="${1:?Usage: restore-database.sh <backup.dump.enc> <target-database-url> [--confirm-overwrite-live]}"
TARGET_URL="${2:?Give the database URL to restore into}"
TARGET_URL="${TARGET_URL%%\?*}"
CONFIRM="${3:-}"

if [ "$TARGET_URL" = "$PG_URL" ] && [ "$CONFIRM" != "--confirm-overwrite-live" ]; then
  echo "Refusing to overwrite the live database. Add --confirm-overwrite-live if that is really intended." >&2
  exit 3
fi

if [ -f "$BACKUP_FILE.sha256" ]; then
  (cd "$(dirname "$BACKUP_FILE")" && sha256sum --check --quiet "$(basename "$BACKUP_FILE").sha256")
else
  echo "Warning: no checksum file next to the backup; integrity not verified." >&2
fi

openssl enc -d "${OPENSSL_CIPHER_ARGS[@]}" -pass "file:$BACKUP_ENCRYPTION_KEY_FILE" -in "$BACKUP_FILE" \
  | pg_restore --clean --if-exists --no-owner --exit-on-error --dbname="$TARGET_URL"
echo "Restored $(basename "$BACKUP_FILE") into $(echo "$TARGET_URL" | sed -E 's#://([^:]+):[^@]*@#://\1:***@#')"
