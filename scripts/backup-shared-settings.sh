#!/usr/bin/env bash
# Shared settings for the backup scripts (DESC control 17). Sourced, not run.
# Everything comes from the environment so laptop and server differ only by
# configuration (§2). Secrets are never stored in the repository (§11 #14).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Fall back to the backend's .env for DATABASE_URL when it is not exported.
if [ -z "${DATABASE_URL:-}" ] && [ -f "$REPO_ROOT/backend/.env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$REPO_ROOT/backend/.env" | head -1 | cut -d= -f2- | tr -d '"')"
fi
: "${DATABASE_URL:?DATABASE_URL is not set}"
# Prisma adds ?schema=… which the PostgreSQL tools do not accept.
PG_URL="${DATABASE_URL%%\?*}"

BACKUP_DIRECTORY="${BACKUP_DIRECTORY:-$HOME/mizan-backups}"
BACKUP_ENCRYPTION_KEY_FILE="${BACKUP_ENCRYPTION_KEY_FILE:-$HOME/.config/mizan/backup-encryption.key}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
# AES-256 with a PBKDF2-derived key; the iteration count slows down guessing.
OPENSSL_CIPHER_ARGS=(-aes-256-cbc -pbkdf2 -iter 200000 -md sha256)

require_key_file() {
  if [ ! -s "$BACKUP_ENCRYPTION_KEY_FILE" ]; then
    echo "Encryption key file not found: $BACKUP_ENCRYPTION_KEY_FILE" >&2
    echo "Backups are never written unencrypted. Create one with:" >&2
    echo "  mkdir -p \"$(dirname "$BACKUP_ENCRYPTION_KEY_FILE")\" && openssl rand -base64 48 > \"$BACKUP_ENCRYPTION_KEY_FILE\" && chmod 600 \"$BACKUP_ENCRYPTION_KEY_FILE\"" >&2
    echo "Keep a copy of the key somewhere other than this server, or the backups cannot be restored." >&2
    exit 2
  fi
}
