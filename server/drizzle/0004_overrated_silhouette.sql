ALTER TABLE "squad_memberships" DROP CONSTRAINT "squad_memberships_legacy_room_id_rooms_id_fk";
--> statement-breakpoint
ALTER TABLE "squads" DROP CONSTRAINT "squads_legacy_room_id_rooms_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "squad_memberships_one_active_canonical_membership_per_user";--> statement-breakpoint
ALTER TABLE "squad_memberships" ADD COLUMN "is_migrated_legacy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Preserve the historical classification even after the legacy Room is deleted.
UPDATE "squad_memberships"
SET "is_migrated_legacy" = true
WHERE "legacy_room_id" IS NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squad_memberships" ADD CONSTRAINT "squad_memberships_legacy_room_id_rooms_id_fk" FOREIGN KEY ("legacy_room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squads" ADD CONSTRAINT "squads_legacy_room_id_rooms_id_fk" FOREIGN KEY ("legacy_room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_one_active_canonical_squad_membership"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW."ended_at" IS NOT NULL OR NEW."is_migrated_legacy" THEN
		RETURN NEW;
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "squad_memberships" sm
		WHERE sm."user_id" = NEW."user_id"
			AND sm."ended_at" IS NULL
			AND sm."id" <> NEW."id"
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23505',
			CONSTRAINT = 'squad_memberships_one_active_membership_per_user',
			MESSAGE = 'A user may hold only one active Membership';
	END IF;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "squad_memberships_one_active_canonical_membership_per_user" ON "squad_memberships" USING btree ("user_id") WHERE "squad_memberships"."ended_at" IS NULL AND "squad_memberships"."is_migrated_legacy" = false;
