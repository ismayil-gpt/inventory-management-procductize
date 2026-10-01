# Installing Mizan on the production server

> For the organisation's IT team. Ref: CLAUDE.md §2 (same code, different configuration),
> §11 (DESC controls). Everything runs on the organisation's own server; nothing goes to a cloud.

## What you need

- A Linux server with Docker Engine and Docker Compose v2, and the NVIDIA Container Toolkit for the GPU.
- An **encrypted disk or partition** (LUKS) for Mizan's data (DESC #2).
- The organisation's **TLS certificate** for the Mizan address: `fullchain.pem` and `privkey.pem` (DESC #1).
- The address of the organisation's **SMTP relay**, for supplier purchase orders.
- One-time internet access during installation only: to build the images and download the language model.

## Install

1. **Copy the code** to the server, for example `/opt/mizan`.
2. **Prepare the data directory** on the encrypted filesystem, for example `/srv/mizan-data`, with
   sub-folders `postgres`, `ollama` and `backups`.
3. **Certificate**: put `fullchain.pem` and `privkey.pem` in a folder readable by root only, for
   example `/etc/mizan/tls`.
4. **Backup key**: `openssl rand -base64 48 > /etc/mizan/backup-encryption.key && chmod 600 /etc/mizan/backup-encryption.key`.
   Keep a second copy away from the server; backups cannot be restored without it.
5. **Settings**: `cp infrastructure/environment-templates/.env.production.example .env.production`,
   replace every `CHANGEME` (`openssl rand -base64 48` for passwords and secrets,
   `openssl rand -base64 32` for `MFA_ENCRYPTION_KEY`), then `chmod 600 .env.production`.
6. **Check the host**: `scripts/check-production-host.sh`. It refuses an unencrypted data
   directory, a self-signed or expiring certificate, a readable settings file, leftover
   `CHANGEME` values and a loose backup key. Fix anything it reports.
7. **Build**: `docker compose -f docker-compose.production.yml --env-file .env.production build`.
8. **Language model** (one time, needs internet):
   `docker compose -f docker-compose.production.yml --env-file .env.production run --rm --network bridge ollama ollama pull qwen2.5:14b-instruct-q4_K_M`
   (or the model the board can hold; see OPEN-QUESTIONS #8). After this, Ollama never reaches the internet.
9. **Start**: `docker compose -f docker-compose.production.yml --env-file .env.production up -d`.
   The `migrate` service creates the schema, applies the append-only rules and tightens the
   application role, then exits; the API starts only after it succeeds.
10. **First data and accounts**: load the organisation's data, create the first administrator
    (`scripts/create-first-administrator.ts`) and the AI service account (`SERVICE_ACCOUNT_EMAIL`).

## What the configuration enforces

| DESC control | How |
|---|---|
| 1 Encryption in transit | nginx: TLS 1.2 and 1.3 only, modern ciphers, HSTS, HTTP redirected to HTTPS (`infrastructure/nginx/nginx.production.conf`) |
| 2 Encryption at rest | every volume lives under `MIZAN_DATA_DIRECTORY`, which the host check requires to be on dm-crypt; backups are AES-256 encrypted on top |
| 11 Network separation | only nginx publishes ports. `edge` and `data` are internal Docker networks; the AI service and Ollama have **no route to the internet**; only the backend has the `mail` network, for SMTP |
| 13 Secure headers | `security-headers.conf` (strict CSP and others) on every page; API docs blocked |
| 17 Backups | the `backup` service runs `scripts/backup-database.sh` daily at `BACKUP_TIME` with a read-only database role |
| 19 Least privilege | the API connects as `mizan_app` (rows only, no schema changes, no UPDATE/DELETE on the audit log or stock movements); migrations run once as `mizan_owner`; backups as read-only `mizan_backup`; the superuser is used only to initialise the database |
| Container hardening | non-root users, read-only filesystems where possible, all Linux capabilities dropped, `no-new-privileges` |

**Firewall**: allow inbound 443 (and 80, which only redirects). Allow outbound only to the SMTP relay.

## Routine operations

- **Weekly restore test**: `scripts/verify-backup-restore.sh` as an account allowed to create a
  database (see `documentation/security-compliance/backup-and-recovery-procedure.md`).
- **Before each release**: `scripts/run-dependency-scan.sh` (DESC #16).
- **Turning on two-step sign-in**: set `MFA_ENABLED=true` and restart `backend`; everyone enrols
  at their next sign-in.
- **Updating**: pull the new code, `build`, then `up -d`. Migrations run automatically.

## Not yet verified on real hardware

The development board cannot run these containers (Docker needs administrator rights there),
so the production stack has been checked statically: the compose file validates, scripts pass
syntax checks, the host check was exercised against test inputs, and the post-migration
privilege script was run against the development database. The first install on the target
server is the first full run, so record its result in `documentation/security-compliance/`.
