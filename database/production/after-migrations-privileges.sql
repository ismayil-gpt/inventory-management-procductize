-- DESC #10 and #19 — run by the `migrate` service after every `prisma migrate deploy`,
-- as mizan_owner. Safe to repeat, and a no-op where the least-privilege roles do not
-- exist (the development database).
--
-- The append-only rules (database/migrations/0001_append_only_rules.sql) already turn
-- UPDATE/DELETE on these tables into no-ops. Removing the privilege as well means the
-- application role is refused outright: two independent locks on the audit trail.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mizan_app') THEN
    EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog", "StockMovement" FROM mizan_app';
    -- Prisma's own bookkeeping table is for migrations only.
    EXECUTE 'REVOKE ALL ON "_prisma_migrations" FROM mizan_app';
  END IF;
END $$;
