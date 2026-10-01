# Mizan backup runner (DESC #17). PostgreSQL 16 client tools plus what the backup
# scripts need. Built ahead of time because the data network has no internet.
FROM postgres:16-alpine
RUN apk add --no-cache bash openssl coreutils
USER postgres
ENTRYPOINT ["/bin/bash", "/mizan/scripts/backup-scheduler.sh"]
