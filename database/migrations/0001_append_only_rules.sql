-- =============================================================================
-- Mizan — Append-only enforcement for audit-critical tables
-- Ref: CLAUDE.md §5, §11.1 control #10 (Log immutability), §12 rule 8
--
-- AuditLog and StockMovement are the system of record. Once written, a row may
-- never be changed or removed. This is a DESC control and this migration file
-- is itself compliance evidence — a copy lives under
-- documentation/security-compliance/.
--
-- Apply AFTER `prisma migrate` has created the tables. Prisma table names are
-- the model names quoted exactly: "AuditLog", "StockMovement".
-- =============================================================================

-- Reject UPDATE and DELETE at the database level, regardless of the caller.
CREATE OR REPLACE RULE "AuditLog_no_update" AS
  ON UPDATE TO "AuditLog" DO INSTEAD NOTHING;
CREATE OR REPLACE RULE "AuditLog_no_delete" AS
  ON DELETE TO "AuditLog" DO INSTEAD NOTHING;

CREATE OR REPLACE RULE "StockMovement_no_update" AS
  ON UPDATE TO "StockMovement" DO INSTEAD NOTHING;
CREATE OR REPLACE RULE "StockMovement_no_delete" AS
  ON DELETE TO "StockMovement" DO INSTEAD NOTHING;

-- Notes for reviewers / auditors:
--  * "DO INSTEAD NOTHING" silently discards the mutating statement so ordinary
--    application code cannot fall back to a soft path. Combined with least
--    privilege (control #19) the runtime DB role is never a superuser and
--    therefore cannot DROP or ALTER these rules.
--  * Corrections are made by INSERTING a compensating record (e.g. an
--    ADJUSTMENT movement), never by editing history — see §12 rule 4.
