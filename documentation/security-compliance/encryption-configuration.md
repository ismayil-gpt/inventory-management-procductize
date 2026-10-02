# Encryption configuration — Mizan

> DESC evidence for controls 1 (in transit) and 2 (at rest), with the related cryptography in
> controls 3, 4, 7 and 17. Written from the code on 2026-10-02.

## In transit (DESC #1)

| Path | Configuration | Where |
|---|---|---|
| Browser → server | TLS 1.2 and 1.3 only; ECDHE with AES-GCM or ChaCha20-Poly1305; no session tickets; HSTS `max-age=63072000; includeSubDomains`; HTTP redirected to HTTPS | `infrastructure/nginx/nginx.production.conf` |
| Certificate | The organisation's certificate (`fullchain.pem`, `privkey.pem`), mounted read-only. `scripts/check-production-host.sh` refuses a self-signed certificate or one expiring within 30 days | production guide, host check |
| Backend → SMTP relay | STARTTLS **required** on port 587 (TLS from the start on 465). If the relay cannot encrypt, the send fails rather than going out in clear. `SMTP_REQUIRE_TLS=false` is a lab-only override | `backend/src/email/email.service.ts`, test in `email.service.spec.ts` |
| Inside the server | Plain HTTP between containers, on internal Docker networks that are not reachable from outside and, for the `data` network, have no internet route (DESC #11) | `docker-compose.production.yml` |

Development: self-signed certificate in `infrastructure/nginx/certs/` (§11.2). The settings are otherwise identical.

## At rest (DESC #2)

| Data | Configuration |
|---|---|
| PostgreSQL, Ollama models, backups | Every production volume is a directory under `MIZAN_DATA_DIRECTORY`, which must be on a LUKS (dm-crypt) device. The host check verifies this with `findmnt` and `lsblk` and fails otherwise; it correctly failed against the unencrypted development disk on 2026-10-01 |
| Backups | Additionally encrypted per file: AES-256-CBC, key derived with PBKDF2-HMAC-SHA256 (200,000 iterations) from a key file outside the repository, random salt, SHA-256 checksum. Backups are never written unencrypted (`scripts/backup-database.sh`) |
| MinIO server-side encryption | Not applicable: no object storage is used (OPEN-QUESTIONS #23) |

Development: the board's disk is not encrypted (§11.2); backups are still AES-256 encrypted.

## Credentials and secrets stored by the application

| Item | How it is stored | Control |
|---|---|---|
| Passwords | argon2id (`@node-rs/argon2`), 12+ characters, common-password blocklist | #3 |
| Refresh tokens | Never stored; only the SHA-256 of each token's random 256-bit id. Rotated on every use | #4 |
| Access and refresh tokens | HS256-signed JWTs with separate secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`); 15 minutes and 7 days | #4 |
| Two-step sign-in secrets | AES-256-GCM with `MFA_ENCRYPTION_KEY` (32 random bytes), random 96-bit IV, authentication tag; format `v1:<base64>` | #7 |
| Backup key | File with mode 600 outside the repository; a copy kept off the server | #17 |
| Configuration secrets | Environment only (`.env.production`, mode 600); never in the repository; `.env*` git-ignored | #14 |

## Key handling

| Key | Created with | Rotation |
|---|---|---|
| TLS certificate | Organisation's certificate authority | Before expiry; the host check warns at 30 days |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | `openssl rand -base64 48` | Changing them signs everyone out; do it on suspicion of exposure |
| `MFA_ENCRYPTION_KEY` | `openssl rand -base64 32` | Changing it makes stored secrets unreadable: reset everyone's two-step sign-in afterwards |
| Backup key | `openssl rand -base64 48` | New backups use the new key; keep old keys as long as old backups are retained |
| LUKS passphrase | Set when the disk is prepared by IT | Per the organisation's disk-encryption policy |

## Not yet verified

TLS settings, the encrypted volume and the production key files are verified on the first
installation on the target server; record the result here (for example, an SSL Labs-style scan
of the internal address and the host check output).
