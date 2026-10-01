# Mizan frontend (React/Vite). Ref: CLAUDE.md §2, §3.1, §4.
# Build context MUST be the repository root — the app imports design tokens and
# translations from /shared, and its CSP from infrastructure/nginx/.

FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY shared ./shared
COPY infrastructure/nginx/security-headers.conf ./infrastructure/nginx/security-headers.conf
COPY frontend ./frontend
# No VITE_API_BASE_URL: the app uses the relative /api/v1, served by the
# reverse proxy on the same origin — no CORS anywhere (§7).
RUN cd frontend && npm run build

# Static files only, served unprivileged (no root, port 8080) on the internal
# network. The edge nginx forwards non-API requests here.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY infrastructure/docker/frontend-static.nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
