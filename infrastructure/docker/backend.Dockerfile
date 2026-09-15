# Mizan backend (NestJS). Ref: CLAUDE.md §2, §3.2, §4.
# Build context is the repository root (see docker-compose.development.yml) so this
# stays consistent with the other Dockerfiles even though the backend does not need
# anything outside backend/.

FROM node:20-alpine AS builder
# Prisma's query engine needs a real OpenSSL on Alpine (musl) — without it "prisma
# generate" / "migrate deploy" fail with a cryptic engine-not-found error.
RUN apk add --no-cache openssl
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
# postgresql-client provides psql, used once at startup to (re-)apply the
# append-only rules below — those live outside Prisma's migration folder
# (database/migrations/, applied by hand historically) so "prisma migrate
# deploy" alone would silently skip DESC control #10 on a fresh database.
RUN apk add --no-cache openssl postgresql-client
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY database/migrations/0001_append_only_rules.sql ./database-migrations/0001_append_only_rules.sql

EXPOSE 3000

# Applies any pending Prisma migrations, then (re-)applies the append-only
# rules (CREATE OR REPLACE RULE — safe to run every start), before starting
# the API. Safe for development; see HOW-TO-RUN.md for the production note.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && psql \"$DATABASE_URL\" -f database-migrations/0001_append_only_rules.sql && node dist/main.js"]
