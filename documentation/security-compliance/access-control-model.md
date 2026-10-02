# Access control model — Mizan

> DESC evidence for control 8 (access control), with 4, 5, 6, 7 and 19. Written from the code on
> 2026-10-02: the endpoint table below is generated from every `*.controller.ts`, and the
> enforcement was checked against the running API.

## Roles

| Role | Who | Can do |
|---|---|---|
| **Administrator** (`ADMIN`) | Store manager, IT administrator | Everything a store keeper can, plus: products, categories, storage structure, suppliers; approve, amend or reject recommendations and generate purchase orders (§12 rule 5); users, sessions and two-step resets; organisation settings; the audit log; the Security and data page |
| **Store keeper** (`STORE_KEEPER`) | Store-room staff | Scan and record all five movement types, cycle counts, read products, locations, stock, recommendations, purchase orders, suppliers, insights, reports; print labels; use the assistant |
| **AI service account** | `ai-service@…`, a machine | Administrator role today (it triggers the daily review, `POST /recommendations/run`); a narrower role is deferred (OPEN-QUESTIONS #21). Exempt from two-step sign-in only from the internal `data` network |

There are exactly two human roles (§1). Roles are stored on the user and checked on the server
for every request; the browser's copy is used only to hide menu items.

## Where access is enforced

1. **Every controller** except health and system info carries `JwtAuthGuard` (a valid, unexpired
   access token) and `RolesGuard`.
2. **The session must still be open** on every request (`JwtAccessStrategy` → `AuthSessionRepository.isActive`):
   sign-out, deactivation, a password change or an administrator's "End sessions" stop a token
   at once (DESC #4).
3. **`@Roles(Role.ADMIN)`** on a method or a whole controller (users, audit log) limits it to
   administrators. The guard reads the role from the verified token, never from the request body (#8).
4. **The frontend** hides what a role cannot use (Audit log, Users, Settings and Security and data
   for store keepers; Approve buttons) — convenience only; the server refuses regardless.
5. **The database** is a second line: the API connects as `mizan_app`, which cannot change the
   schema and cannot UPDATE or DELETE audit or movement rows (#19).

## Sign-in protections

| Control | Behaviour |
|---|---|
| Passwords (#3) | argon2id; 12+ characters; common-password blocklist |
| Lockout (#5) | 5 failed attempts, password or two-step code, lock the account for 15 minutes; audited |
| Rate limiting (#12) | 10 requests per minute per client and endpoint on `/auth/*`; then HTTP 429 |
| Two-step sign-in (#7) | Authenticator-app codes when `MFA_ENABLED=true`; enrolment at first sign-in; administrator reset for lost phones |
| Sessions (#4) | 15-minute access tokens, 7-day rotating refresh tokens; reuse of a spent refresh token ends the session |
| Idle timeout (#6) | Signed out after 30 minutes without activity, with a one-minute warning |

## Endpoints and who may call them

"Public" endpoints are the sign-in steps (each rate limited), the health check and the
deployment's display name. Everything else needs a signed-in user with an open session.

| Area | Method | Endpoint | Who |
|---|---|---|---|
| assistant | POST | `/api/v1/assistant/query` | Any signed-in user |
| audit-log | GET | `/api/v1/audit-log` | Administrator only |
| auth | POST | `/api/v1/auth/login` | Public |
| auth | POST | `/api/v1/auth/mfa/verify` | Public |
| auth | POST | `/api/v1/auth/mfa/enroll/start` | Public |
| auth | POST | `/api/v1/auth/mfa/enroll/confirm` | Public |
| auth | POST | `/api/v1/auth/refresh` | Public |
| auth | POST | `/api/v1/auth/logout` | Any signed-in user |
| auth | GET | `/api/v1/auth/me` | Any signed-in user |
| barcode-labels | GET | `/api/v1/barcode-labels/product/:id` | Any signed-in user |
| barcode-labels | GET | `/api/v1/barcode-labels/location/:id` | Any signed-in user |
| barcode-labels | POST | `/api/v1/barcode-labels/batch` | Any signed-in user |
| cycle-counts | GET | `/api/v1/cycle-counts` | Any signed-in user |
| cycle-counts | POST | `/api/v1/cycle-counts` | Any signed-in user |
| cycle-counts | GET | `/api/v1/cycle-counts/:id` | Any signed-in user |
| cycle-counts | POST | `/api/v1/cycle-counts/:id/scan` | Any signed-in user |
| cycle-counts | POST | `/api/v1/cycle-counts/:id/close` | Any signed-in user |
| dashboard | GET | `/api/v1/dashboard/summary` | Any signed-in user |
| health | GET | `/api/v1/health` | Public |
| location-types | GET | `/api/v1/location-types` | Any signed-in user |
| organization | GET | `/api/v1/organization` | Any signed-in user |
| organization | PATCH | `/api/v1/organization` | Administrator only |
| predictive-analytics | GET | `/api/v1/predictive-analytics/summary` | Any signed-in user |
| predictive-analytics | GET | `/api/v1/predictive-analytics/forecast/:productId` | Any signed-in user |
| product-categories | GET | `/api/v1/product-categories` | Any signed-in user |
| products | POST | `/api/v1/products` | Administrator only |
| products | PATCH | `/api/v1/products/:id` | Administrator only |
| products | DELETE | `/api/v1/products/:id` | Administrator only |
| products | GET | `/api/v1/products` | Any signed-in user |
| products | GET | `/api/v1/products/resolve/:barcode` | Any signed-in user |
| products | GET | `/api/v1/products/import-template` | Any signed-in user |
| products | POST | `/api/v1/products/import` | Administrator only |
| products | GET | `/api/v1/products/:id` | Any signed-in user |
| products | GET | `/api/v1/products/:id/stock` | Any signed-in user |
| purchase-orders | GET | `/api/v1/purchase-orders` | Any signed-in user |
| purchase-orders | POST | `/api/v1/purchase-orders/generate` | Administrator only |
| purchase-orders | GET | `/api/v1/purchase-orders/:id/pdf` | Any signed-in user |
| recommendations | GET | `/api/v1/recommendations` | Any signed-in user |
| recommendations | POST | `/api/v1/recommendations/run` | Administrator only |
| recommendations | POST | `/api/v1/recommendations/:id/approve` | Administrator only |
| recommendations | POST | `/api/v1/recommendations/:id/reject` | Administrator only |
| reports | GET | `/api/v1/reports/stock-on-hand` | Any signed-in user |
| reports | GET | `/api/v1/reports/stock-movements` | Any signed-in user |
| reports | GET | `/api/v1/reports/replenishment` | Any signed-in user |
| stock-movements | POST | `/api/v1/stock-movements` | Any signed-in user |
| stock-movements | GET | `/api/v1/stock-movements` | Any signed-in user |
| storage-locations | POST | `/api/v1/storage-locations` | Administrator only |
| storage-locations | POST | `/api/v1/storage-locations/bulk-create` | Administrator only |
| storage-locations | PATCH | `/api/v1/storage-locations/:id` | Administrator only |
| storage-locations | DELETE | `/api/v1/storage-locations/:id` | Administrator only |
| storage-locations | GET | `/api/v1/storage-locations` | Any signed-in user |
| storage-locations | GET | `/api/v1/storage-locations/resolve/:barcode` | Any signed-in user |
| storage-locations | GET | `/api/v1/storage-locations/:id` | Any signed-in user |
| storage-locations | GET | `/api/v1/storage-locations/:id/stock` | Any signed-in user |
| suppliers | GET | `/api/v1/suppliers` | Any signed-in user |
| suppliers | POST | `/api/v1/suppliers` | Administrator only |
| suppliers | PATCH | `/api/v1/suppliers/:id` | Administrator only |
| suppliers | DELETE | `/api/v1/suppliers/:id` | Administrator only |
| system | GET | `/api/v1/system/info` | Public |
| units-of-measure | GET | `/api/v1/units-of-measure` | Any signed-in user |
| users | GET | `/api/v1/users` | Administrator only |
| users | POST | `/api/v1/users` | Administrator only |
| users | PATCH | `/api/v1/users/:id` | Administrator only |
| users | POST | `/api/v1/users/:id/end-sessions` | Administrator only |
| users | POST | `/api/v1/users/:id/reset-mfa` | Administrator only |
| users | DELETE | `/api/v1/users/:id` | Administrator only |

**66 endpoints**: 23 administrator-only,
36 for any signed-in user, 7 public.

## Verified against the running API (2026-10-02)

| Request | No sign-in | Store keeper | Administrator |
|---|---|---|---|
| `GET /products` | 401 | 200 | 200 |
| `GET /stock-movements` | 401 | 200 | 200 |
| `GET /audit-log` | 401 | **403** | 200 |
| `GET /users` | 401 | **403** | 200 |
| `POST /recommendations/run` | 401 | **403** | (not called: changes data) |
| `POST /purchase-orders/generate` | 401 | **403** | (not called) |
| `PATCH /organization` | 401 | **403** | (not called) |
| `POST /suppliers` | 401 | **403** | (not called) |

Session revocation, refresh reuse, lockout, rate limiting and two-step sign-in each have their
own tests and live runs; see `control-implementation-matrix.md`.

## Keeping this accurate

When adding an endpoint, set its role in the controller with `@Roles`, then regenerate the table:
`python3 scripts/list-endpoint-roles.py --markdown`.
