# How to Run Mizan (development laptop)

> Plain, step-by-step. No Docker needed on the laptop — you run two small servers:
> the **backend** (the API) and the **frontend** (the website). Docker comes later on
> the GPU server. Prerequisites already on this machine: **Node.js 24**, **Python 3.14**,
> **PostgreSQL 18** (running as a Windows service — starts automatically with Windows).

## The short version

Open **two** terminals.

**Terminal 1 — backend (API):**
```bash
cd "C:/Users/Hi/Music/Inventory Management Productize/backend"
npm install       # first time only
npm run db:seed   # first time only — loads demo data + demo users
npm run start:dev
```
Wait for: `Mizan API listening on http://localhost:3000/api/v1`

**Terminal 2 — frontend (website):**
```bash
cd "C:/Users/Hi/Music/Inventory Management Productize/frontend"
npm install       # first time only
npm run dev
```
Then open **http://localhost:5173** in your browser.

## Logging in
You'll land on the **sign-in screen**. Use a demo account:

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@example.com` | `Admin@Mizan2026` |
| Store Keeper | `storekeeper@example.com` | `Store@Mizan2026` |

(After 5 wrong passwords an account locks for 15 minutes — that's the security policy, working as intended.)

## What you should see
- The Mizan app shell: navigation rail on the side, top bar (with your name + a sign-out button), and a status strip at the bottom.
- The dashboard tiles (products, shelves, low stock, etc.) show **live numbers from the database**.
- The dashboard shows a **"Backend connection established"** panel with live values
  (app name, organization, Node version, uptime). That panel is the proof the website and
  the API are talking to each other.
- Bottom status strip: a green dot = connected. The dashboard should now show
  **`Database: connected`** (PostgreSQL is wired up). If it says `disconnected`, the
  PostgreSQL service isn't running — start it from Windows *Services* (`postgresql-x64-18`).
- Top-right buttons switch **theme** (light/dark) and **language** (English/العربية). Arabic
  flips the whole layout right-to-left. Both choices are remembered.

## Handy URLs (while the servers run)
| What | URL |
|---|---|
| The website | http://localhost:5173 |
| API health check | http://localhost:3000/api/v1/health |
| API docs (Swagger) | http://localhost:3000/api/v1/docs |

## Stopping
Press **Ctrl + C** in each terminal.

## If something doesn't work
- **"Backend connection failed" on the dashboard** → the backend terminal isn't running,
  or hasn't finished starting. Check Terminal 1 shows the "listening" line.
- **Port already in use** → an old copy is still running. Close other terminals, or restart
  the machine, and try again.
- **`npm install` errors** → make sure you're in the right folder (`backend` or `frontend`)
  and connected to the internet for the first install only.

## What "running the whole thing" will mean later
Right now only **frontend + backend** run (by design — to check they work). The **database**,
the **AI service**, and **Docker** come next; on the GPU server the whole stack starts with a
single `docker compose -f docker-compose.production.yml up`. See
[`documentation/gpu-readiness-and-upgrades.md`](documentation/gpu-readiness-and-upgrades.md).
