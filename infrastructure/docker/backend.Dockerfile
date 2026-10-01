# Mizan backend (NestJS). Ref: CLAUDE.md §2, §3.2, §4.
# Build context is the repository root, consistent with the other Dockerfiles.
# One image, two jobs: the API (default command) and the one-shot `migrate`
# service (infrastructure/docker/backend-migrate.sh), so schema changes run with
# the owner role and the API runs with the narrower app role (DESC #19).

FROM node:20-alpine AS builder
# Prisma's query engine needs a real OpenSSL on Alpine (musl).
RUN apk add --no-cache openssl
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
# postgresql-client: psql applies the append-only rules and post-migration
# privileges, which live outside Prisma's migrations folder (DESC #10, #19).
RUN apk add --no-cache openssl postgresql-client
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --chown=node:node database/migrations/0001_append_only_rules.sql ./database-migrations/0001_append_only_rules.sql
COPY --chown=node:node database/production/after-migrations-privileges.sql ./database-migrations/after-migrations-privileges.sql
COPY --chown=node:node infrastructure/docker/backend-migrate.sh ./migrate.sh

# Never run as root inside the container.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/src/main.js"]
