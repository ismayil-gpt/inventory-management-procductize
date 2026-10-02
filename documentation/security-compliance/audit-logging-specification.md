# Audit logging specification — Mizan

> DESC evidence for controls 9 (audit logging) and 10 (log immutability), with 15 (log hygiene).
> Written from the code on 2026-10-02. Every action listed here was found in the source;
> regenerate the list with `grep -rn "auditLog.create\|writeAudit\|auditedUserUpdate" backend/src`.

## The rule

Every state change writes an audit record **in the same database transaction** as the change
(CLAUDE.md §12 rule 8). If the change is saved, its record is saved; if either fails, neither is.

## What a record holds (`AuditLog` table)

| Field | Content |
|---|---|
| `id` | Unique id |
| `createdAt` | Server time of the change (stored UTC, shown in Gulf Standard Time) |
| `actorId` | The user who acted (null for the system's own scheduled work) |
| `action` | What happened, for example `STOCK_GOODS_OUT`, `RECOMMENDATION_APPROVED` |
| `entityType`, `entityId` | Which record was affected |
| `before`, `after` | The relevant values before and after the change (JSON); never password hashes or secrets |
| `ipAddress` | Client address, for sign-in events (taken from nginx's `X-Forwarded-For` in production) |

## What is recorded

| Area | Actions | Same transaction as the change |
|---|---|---|
| Stock | `STOCK_GOODS_IN`, `STOCK_GOODS_OUT`, `STOCK_TRANSFER`, `STOCK_ADJUSTMENT`, `STOCK_CYCLE_COUNT` (one per movement, with stock before and after) | Yes |
| Cycle counts | `CYCLE_COUNT_CLOSE` (with the variance applied) | Yes |
| Replenishment | `RECOMMENDATION_GENERATED`, `RECOMMENDATION_APPROVED`, `RECOMMENDATION_AMENDED`, `RECOMMENDATION_REJECTED` | Yes |
| Purchasing | `PURCHASE_ORDER_CREATE` | Yes |
| Products | `PRODUCT_CREATE`, `PRODUCT_UPDATE`, `PRODUCT_DELETE`, `PRODUCT_IMPORT` | Yes |
| Storage structure | `LOCATION_CREATE`, `LOCATION_UPDATE`, `LOCATION_BULK_CREATE`, `LOCATION_DELETE` | Yes |
| Suppliers | `SUPPLIER_CREATE`, `SUPPLIER_UPDATE`, `SUPPLIER_DELETE` | Yes (create and update fixed 2026-10-02) |
| Organisation | `ORGANIZATION_UPDATE` | Yes |
| Users | `USER_CREATE`, `USER_UPDATE` (role, active, password reset flag), `USER_DELETE`, `USER_MFA_RESET` | Yes |
| Sign-in | `LOGIN_SUCCESS` (with `secondFactor` when a code or service exemption was used), `LOGIN_FAILED`, `ACCOUNT_LOCKED`, `MFA_FAILED`, `MFA_ENROLLMENT_STARTED`, `MFA_ENROLLED` | Yes, with the user-row change (fixed 2026-10-02) |
| Sign-in, no row changed | `LOGIN_MFA_CHALLENGE`, `LOGIN_MFA_ENROLLMENT_REQUIRED`, `LOGOUT` (with the session id) | Event only; a failed audit write fails the request |
| Sessions | `SESSION_REFRESH_REUSE`, `USER_SESSIONS_ENDED` (reason and count) | Written right after the session change. Sessions are access records, not business records; see "Known limits" |
| Assistant | `ASSISTANT_QUERY` (question text, language, number of source records) | Not a state change; recorded for accountability |

## Immutability (DESC #10)

Two independent locks:

1. **PostgreSQL rules** (`database/migrations/0001_append_only_rules.sql`) turn any `UPDATE` or
   `DELETE` on `AuditLog` and `StockMovement` into a no-op. They are re-applied on every
   deployment by the `migrate` service and survive backup and restore (checked in the
   2026-10-01 restore test: 4 of 4 rules present).
2. **Privileges** (`database/production/after-migrations-privileges.sql`): in production the
   application role `mizan_app` has no `UPDATE`, `DELETE` or `TRUNCATE` on either table, so the
   database refuses the statement outright.

Records are never edited in the application either: corrections are new records (for example
an `ADJUSTMENT` movement with a reason of at least 10 characters).

## Who can read it

Administrators only, in the app (**Audit log**, filter by record type and action) and through
`GET /api/v1/audit-log` (DESC #8). Store keepers are refused with 403.

## Retention

Nothing deletes audit records; the table only grows. At this deployment's scale (5 users, about
2,000 movements a month) that is a few megabytes a year. Backups keep the history for as long as
backups are retained (14 days by default). The organisation's retention period for audit data
is to be confirmed (OPEN-QUESTIONS #24); until then everything is kept.

## Application logs are separate (DESC #15)

Container logs (Pino JSON) are for troubleshooting, not accountability. They carry the user id,
method, path and status, and redact emails, IP addresses, tokens, passwords and query strings.
The audit log is the only place that records who did what, and from where.

## Known limits

- Session table changes (sign-out, revocation) are written and then audited in two steps. A crash
  between them would leave a revoked session without its `USER_SESSIONS_ENDED` record; the
  revocation itself is still in the `AuthSession` row (`revokedAt`, `revokedReason`).
- `ASSISTANT_QUERY` stores the question as typed; staff should not put personal data in questions.
- Re-seeding the development database leaves earlier movement rows pointing at removed demo
  products (OPEN-QUESTIONS #14). This does not happen in production, which is never re-seeded.
