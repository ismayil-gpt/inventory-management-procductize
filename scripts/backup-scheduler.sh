#!/usr/bin/env bash
# Runs scripts/backup-database.sh once a day at BACKUP_TIME (local time, default
# 02:00) inside the production `backup` container (DESC #17). A failed backup is
# logged and retried at the next run; the container keeps going.
set -u
BACKUP_TIME="${BACKUP_TIME:-02:00}"
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"

seconds_until_next_run() {
  local now target
  now=$(date +%s)
  target=$(date -d "today $BACKUP_TIME" +%s)
  [ "$target" -le "$now" ] && target=$(date -d "tomorrow $BACKUP_TIME" +%s)
  echo $(( target - now ))
}

echo "Backup scheduler started; daily at $BACKUP_TIME ($(date +%Z))."
while true; do
  sleep "$(seconds_until_next_run)"
  if "$SCRIPTS/backup-database.sh"; then
    echo "$(date -Iseconds) backup OK"
  else
    echo "$(date -Iseconds) backup FAILED — check the database and key file" >&2
  fi
done
