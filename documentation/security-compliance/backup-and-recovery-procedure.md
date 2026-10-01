# Backup and recovery procedure — DESC control 17

> Ref: CLAUDE.md §11.1 (#17 "automated encrypted backups, documented and tested restore"),
> §11.2 (development caveats). Scripts live in `scripts/`.

## What is backed up

The whole PostgreSQL database `mizan_inventory`: stock, movements, the audit log, users,
products, locations, recommendations and purchase orders. Purchase-order PDFs are regenerated
on demand from the database, so they need no separate backup. Configuration and secrets are
injected at deploy time and are not part of the backup.

## How

| Step | Script | Detail |
|---|---|---|
| Back up | `scripts/backup-database.sh` | `pg_dump` custom format, compressed → AES-256-CBC with a PBKDF2-derived key (200,000 iterations) from a key file → `.sha256` checksum. Written as `.partial` and renamed only when complete. Files older than `BACKUP_RETENTION_DAYS` (14) are removed. Refuses to run without a key: backups are never written unencrypted. |
| Restore | `scripts/restore-database.sh <file> <database-url>` | Verifies the checksum first, decrypts, `pg_restore --clean --if-exists --exit-on-error`. Refuses to overwrite the live database unless `--confirm-overwrite-live` is given. |
| Prove it | `scripts/verify-backup-restore.sh` | Fresh backup → restore into a throwaway database → compare every table's row count with live → confirm the four append-only rules (control 10) survived → drop the throwaway database → file a dated record in `restore-test-records/`. |

Settings (all environment, see `infrastructure/environment-templates/.env.example`):
`BACKUP_DIRECTORY`, `BACKUP_ENCRYPTION_KEY_FILE`, `BACKUP_RETENTION_DAYS`, plus `DATABASE_URL`.

## The encryption key

- Create once: `openssl rand -base64 48 > <key file> && chmod 600 <key file>`.
- Never in the repository, never in the backup directory.
- **Keep a second copy away from the server** (sealed envelope or the organisation's secrets vault).
  Without the key the backups cannot be restored; with only the backups, an attacker learns nothing.

## Schedule

Daily at 02:00 GST, after the day's work and before the 07:00 replenishment review, and a weekly
tested restore. On the production server, as the service account:

```cron
0 2 * * *  cd /opt/mizan && scripts/backup-database.sh          >> /var/log/mizan-backup.log 2>&1
30 3 * * 0 cd /opt/mizan && scripts/verify-backup-restore.sh    >> /var/log/mizan-backup.log 2>&1
```

Copy `BACKUP_DIRECTORY` to storage that is not this server (a second on-premise host or
encrypted removable media) as part of the organisation's normal off-site rotation. Backups are
already encrypted, so the copy needs no extra handling. This keeps data on-premise (control 18).

## Recovery targets

- **Recovery point:** at most 24 hours of data with daily backups. Scans made offline are still
  in each device's outbox and will sync again after a restore, because movements are idempotent on
  `clientId` (§6).
- **Recovery time:** minutes. The 2026-10-01 test took 4 seconds end to end on the development board.

## Restoring for real

1. Stop the backend so nothing writes during the restore.
2. Pick the newest backup and keep its `.sha256` next to it.
3. Restore into a new database first: create it, run `restore-database.sh <file> <new-url>`, check it.
4. Point `DATABASE_URL` at the restored database (or restore over live with `--confirm-overwrite-live`).
5. Start the backend. Confirm `/api/v1/health`, sign in, and check the audit log's latest entries.
6. Record the restore (date, file, who, why) in `restore-test-records/`.

## Development environment caveat (§11.2)

On the development board the backups go to `~/mizan-backups` on the same disk and are not yet
scheduled. The scripts, encryption and tested restore are identical to production; the gap is
the schedule and the off-site copy, which belong to the production server.

## Test record

- `restore-test-records/2026-10-01-restore-test.md`: **PASS**. 17 tables, all row counts
  identical, 4 of 4 append-only rules restored.
