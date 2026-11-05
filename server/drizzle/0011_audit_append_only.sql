-- An Audit Entry is append-only. The one change a row may take is its actor reference going to NULL,
-- which is what the actor foreign key's ON DELETE SET NULL does when that account is deleted (the
-- name snapshot stays). Any other UPDATE and every DELETE is refused.
CREATE OR REPLACE FUNCTION "audit_entries_append_only"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD."actor_id" IS NOT NULL
    AND NEW."actor_id" IS NULL
    AND ROW (NEW."id", NEW."actor_name", NEW."action", NEW."target", NEW."reason", NEW."details", NEW."created_at")
      IS NOT DISTINCT FROM ROW (OLD."id", OLD."actor_name", OLD."action", OLD."target", OLD."reason", OLD."details", OLD."created_at")
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_entries is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_entries_append_only" ON "audit_entries";
--> statement-breakpoint
CREATE TRIGGER "audit_entries_append_only"
  BEFORE UPDATE OR DELETE ON "audit_entries"
  FOR EACH ROW EXECUTE FUNCTION "audit_entries_append_only"();
