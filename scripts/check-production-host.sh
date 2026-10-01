#!/usr/bin/env bash
# Pre-flight for a production install (run on the host before `docker compose up`).
# Checks the things the containers cannot check for themselves:
#   DESC #2  — MIZAN_DATA_DIRECTORY is on an encrypted (dm-crypt/LUKS) device
#   DESC #1  — a certificate and key are in TLS_CERTIFICATE_DIRECTORY and not expiring soon
#   DESC #14 — .env.production exists, is not world-readable, and has no CHANGEME left
#   DESC #17 — the backup key file exists and is readable only by its owner
# Exits non-zero on any failure.
set -u
ENV_FILE="${1:-.env.production}"
fail=0
ok()   { echo "  OK    $1"; }
bad()  { echo "  FAIL  $1"; fail=1; }

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE (copy infrastructure/environment-templates/.env.production.example)"; exit 1; }
set -a; . "./$ENV_FILE"; set +a

echo "Mizan production host check"

perm=$(stat -c %a "$ENV_FILE")
[ "${perm: -1}" = "0" ] && ok "$ENV_FILE is not world-readable ($perm)" || bad "$ENV_FILE is world-readable ($perm) — chmod 600 it"
grep -q "CHANGEME" "$ENV_FILE" && bad "$ENV_FILE still contains CHANGEME values" || ok "no CHANGEME values left"

if [ -n "${MIZAN_DATA_DIRECTORY:-}" ] && [ -d "$MIZAN_DATA_DIRECTORY" ]; then
  source_device=$(findmnt -n -o SOURCE --target "$MIZAN_DATA_DIRECTORY")
  if lsblk -s -n -o TYPE "$source_device" 2>/dev/null | grep -q '^crypt$'; then
    ok "data directory $MIZAN_DATA_DIRECTORY is on an encrypted device ($source_device)"
  else
    bad "data directory $MIZAN_DATA_DIRECTORY is NOT on an encrypted device ($source_device) — DESC #2"
  fi
else
  bad "MIZAN_DATA_DIRECTORY is unset or does not exist"
fi

cert="${TLS_CERTIFICATE_DIRECTORY:-}/fullchain.pem"; key="${TLS_CERTIFICATE_DIRECTORY:-}/privkey.pem"
if [ -f "$cert" ] && [ -f "$key" ]; then
  if openssl x509 -checkend $((30*86400)) -noout -in "$cert" >/dev/null; then
    ok "TLS certificate valid for 30+ days ($(openssl x509 -noout -enddate -in "$cert" | cut -d= -f2))"
  else
    bad "TLS certificate expires within 30 days"
  fi
  issuer=$(openssl x509 -noout -issuer -nameopt RFC2253 -in "$cert" | cut -d= -f2-)
  subject=$(openssl x509 -noout -subject -nameopt RFC2253 -in "$cert" | cut -d= -f2-)
  [ "$issuer" = "$subject" ] && bad "certificate is self-signed — use the organisation's certificate" || ok "certificate is issued by $issuer"
else
  bad "fullchain.pem / privkey.pem not found in TLS_CERTIFICATE_DIRECTORY"
fi

if [ -f "${BACKUP_ENCRYPTION_KEY_FILE:-}" ]; then
  kperm=$(stat -c %a "$BACKUP_ENCRYPTION_KEY_FILE")
  [ "$kperm" = "600" ] || [ "$kperm" = "400" ] && ok "backup key present ($kperm)" || bad "backup key permissions are $kperm — use 600"
else
  bad "BACKUP_ENCRYPTION_KEY_FILE not found"
fi

[ "$fail" = 0 ] && echo "All checks passed." || echo "Fix the failures above before starting Mizan."
exit $fail
