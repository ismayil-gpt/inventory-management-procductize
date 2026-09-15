# Mizan — Public Demo Hosting Guide

> **This is a DEMO-hosting path, deliberately separate from the product.** The sold product is
> **on-premise** (that is the whole pitch — data residency, air-gap). Host only
> **fake demo data**, never a real client's data. Nothing here changes the
> local workflow: `npm run dev` + local PostgreSQL keep working exactly as before. The only code that
> is "hosting-aware" is env-gated and falls back to local behaviour when the env vars are unset.

There are two ways to make the demo reachable on any device. Pick by how permanent you need it.

---

## Option A — Cloudflare Tunnel (fastest, keeps everything local)  ⭐ best for "show it this week"

Exposes the app **already running on your laptop** at a public HTTPS URL. Nothing migrates: local
Postgres, local backend, and (later) the local AI all keep working. The only requirement is that the
laptop is on and the two dev servers are running during the demo.

1. Install `cloudflared` (Cloudflare Tunnel). Free Cloudflare account.
2. Make sure both dev servers are up: backend on `:3000`, frontend on `:5173`.
3. Point the tunnel at the **frontend** (it already proxies `/api` to the backend):
   ```
   cloudflared tunnel --url http://localhost:5173
   ```
   It prints a public `https://<random>.trycloudflare.com` URL. Open it on any phone/laptop.
4. For a stable custom subdomain, create a **named tunnel** bound to a domain you own in Cloudflare
   (one-time `cloudflared tunnel create` + a DNS route), instead of the random quick URL.

Pros: 30 minutes, free, full stack incl. local AI, zero cloud migration.
Cons: laptop must be online; not "always on".

> Tip: the demo already has real auth (JWT, argon2, lockout). Still, only expose demo data, and share
> the demo logins from the sidebar helper.

---

## Option B — Firebase Hosting + Cloud Run + Cloud SQL (always-on)

Always-available, professional URL, independent of your laptop. This is **Firebase Hosting for the
React build + Google Cloud for the backend and database** (Firebase alone can't run a Node/Postgres
app — its database is Firestore/NoSQL, which does not fit our Prisma/PostgreSQL model).

```
Browser ──► Firebase Hosting (static React)
               │  rewrite /api/**  (same origin, no CORS)
               ▼
            Cloud Run (NestJS backend)  ──►  Cloud SQL (PostgreSQL)
```

### Prerequisites
- A Google Cloud project with **billing enabled** (Cloud SQL is not free; budget ~US$10–15/month).
- `gcloud` CLI and `firebase` CLI installed and logged in to **your** account.
- Region: examples use `me-central1` (Doha, closest GCP region to the UAE). Change if you prefer.

### 1) Database — Cloud SQL for PostgreSQL
1. Create a small Postgres 16 instance; note its **connection name** `PROJECT:REGION:INSTANCE`.
2. Create a database `mizan` and a user `mizan` with a strong password.

### 2) One required code note before deploying the backend (non-breaking)
Cloud Run runs Linux, so Prisma needs its Linux query engine. Add a binary target to
`backend/prisma/schema.prisma` (this is additive — local keeps using `native`):
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}
```
Then `npx prisma generate` once. (Leave it in — it does not affect local runs.)

### 3) Backend — Cloud Run (deploy from source, no Dockerfile needed)
From the repo root:
```
gcloud run deploy mizan-backend \
  --source backend \
  --region me-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances PROJECT:REGION:INSTANCE \
  --set-env-vars NODE_ENV=production \
  --set-env-vars "DATABASE_URL=postgresql://mizan:PASSWORD@localhost/mizan?host=/cloudsql/PROJECT:REGION:INSTANCE" \
  --set-env-vars JWT_SECRET=<random-32+>,JWT_REFRESH_SECRET=<random-32+> \
  --set-env-vars CORS_ORIGIN=https://YOUR-SITE.web.app
```
Notes:
- The backend already honours Cloud Run's injected `PORT` and binds `0.0.0.0` (no change needed).
- Keep `NODE_ENV=production` so the sidebar **demo-login** helper is NOT exposed publicly.
- Verify the built entrypoint the platform runs. `nest build` outputs to `backend/dist`; the app's
  entry is `dist/src/main.js`. If the buildpack's default `npm start` doesn't boot it, set the start
  script to `node dist/src/main.js`.

### 4) Schema + demo data on the cloud DB
Run migrations and seed the **demo** data against Cloud SQL from your machine via the Cloud SQL Auth
Proxy:
```
# terminal 1: proxy the instance to localhost:5433
cloud-sql-proxy PROJECT:REGION:INSTANCE --port 5433

# terminal 2 (repo root):
$env:DATABASE_URL="postgresql://mizan:PASSWORD@localhost:5433/mizan"
npx --prefix backend prisma migrate deploy
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "host=localhost port=5433 dbname=mizan user=mizan" -f database/migrations/0001_append_only_rules.sql
# seed a demo entity (e.g. the neutral sample):
$env:ENTITY_CODE="ACME"; $env:ENTITY_NAME_EN="Acme Distribution"; $env:ENTITY_SAMPLE="true"
npx --prefix backend tsx backend/prisma/entity-seed.ts
```

### 5) Frontend — Firebase Hosting
1. Build (no API env needed — the `/api` rewrite makes it same-origin):
   ```
   npm --prefix frontend run build
   ```
2. In `hosting/`, copy `.firebaserc.example` to `.firebaserc` and set your project id.
   Confirm `firebase.json`'s `run.serviceId` (`mizan-backend`) and `region` match your Cloud Run
   service.
3. Deploy:
   ```
   cd hosting && firebase deploy --only hosting
   ```
   Your site is live at `https://YOUR-SITE.web.app`, with `/api/**` transparently routed to Cloud Run.

Pros: always on, one clean URL, no CORS (same origin via rewrite).
Cons: more setup, small monthly cost, your GCP account/billing required (I can't deploy to it for you).

---

## What about the AI?

Two different engines — only one needs the GPU:

1. **Replenishment AI (reorder recommendations + reasoning)** — deterministic maths **inside the
   NestJS backend**, no GPU. It works on Cloud Run today. Your hosted demo keeps its AI.
2. **Conversational LLM assistant (Phase 2, Ollama)** — needs the GPU/Jetson; not built yet. For a
   cloud demo later it can be pointed at a **hosted LLM** via the model-provider abstraction (§2.1) —
   a config switch, not a rewrite — while the on-prem product keeps using local Ollama. So hosting is
   **not blocked** by the AI.

---

## Keeping local intact (what changed, and why it's safe)
- `frontend/src/api-client/client.ts` — `API_BASE` is now `import.meta.env.VITE_API_BASE_URL ?? '/api/v1'`.
  Unset locally → identical `/api/v1` behaviour through the Vite proxy.
- `backend/src/main.ts` — listens on `PORT ?? API_PORT ?? 3000` and binds `0.0.0.0`. Local has no
  `PORT`, so it still uses `3000`.
- Everything else for hosting lives here in `hosting/` and in `.env*.example` files — additive, never
  loaded by local dev.
