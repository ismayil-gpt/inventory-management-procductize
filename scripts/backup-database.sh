#!/usr/bin/env bash
# Encrypted database backup (DESC control 17).
#   pg_dump (custom format, compressed) → AES-256 with a key file → .sha256 checksum
#   → backups older than BACKUP_RETENTION_DAYS are removed.
# Schedule it daily (see documentation/security-compliance/backup-and-recovery-procedure.md).
set -euo pipefail
source "$(dirname "$0")/backup-shared-settings.sh"
require_key_file
umask 077
mkdir -p "$BACKUP_DIRECTORY"

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIRECTORY/mizan-$STAMP.dump.enc"
PARTIAL="$TARGET.partial"
trap 'rm -f "$PARTIAL"' EXIT

pg_dump --format=custom --compress=9 --no-owner --dbname="$PG_URL" \
  | openssl enc "${OPENSSL_CIPHER_ARGS[@]}" -salt -pass "file:$BACKUP_ENCRYPTION_KEY_FILE" -out "$PARTIAL"
# Only a complete file gets the real name, so a crash never leaves a half backup that looks whole.
mv "$PARTIAL" "$TARGET"
(cd "$BACKUP_DIRECTORY" && sha256sum "$(basename "$TARGET")" > "$(basename "$TARGET").sha256")

find "$BACKUP_DIRECTORY" -maxdepth 1 -name 'mizan-*.dump.enc*' -mtime +"$BACKUP_RETENTION_DAYS" -delete
echo "Backup written: $TARGET ($(du -h "$TARGET" | cut -f1))"
