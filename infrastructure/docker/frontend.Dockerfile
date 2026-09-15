# Mizan frontend (React/Vite). Ref: CLAUDE.md §2, §3.1, §4.
# Build context MUST be the repository root — the app imports design tokens and
# translations from /shared (outside the frontend/ folder) via the @shared alias.

FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY shared ./shared
COPY frontend ./frontend
# No VITE_API_BASE_URL is set here on purpose: the app defaults to the relative
# path /api/v1, which the reverse-proxy nginx serves from the same origin as the
# static files below — this is what keeps the whole stack CORS-free (§7).
RUN cd frontend && npm run build

# Static files only, served by a small nginx — separate from the reverse-proxy
# nginx in docker-compose.development.yml, which forwards non-API requests here.
FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY infrastructure/docker/frontend-static.nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
