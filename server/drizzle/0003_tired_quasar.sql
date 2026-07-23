CREATE TYPE "public"."squad_idempotency_operation" AS ENUM('create', 'join', 'leave_current');--> statement-breakpoint
CREATE TYPE "public"."squad_lifecycle_state" AS ENUM('recruiting', 'ready');--> statement-breakpoint
CREATE TYPE "public"."squad_membership_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ready_notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"squad_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"readiness_at" timestamp with time zone NOT NULL,
	"squad_code" varchar(6) NOT NULL,
	"squad_name" varchar(100) NOT NULL,
	"game_name" varchar(100) NOT NULL,
	"discord_invitation" text NOT NULL,
	"legacy_notification_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ready_notifications_legacy_notification_id_unique" UNIQUE("legacy_notification_id"),
	CONSTRAINT "ready_notifications_squad_user_readiness_unique" UNIQUE("squad_id","user_id","readiness_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "squad_idempotency_receipts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"key" varchar(255) NOT NULL,
	"operation" "squad_idempotency_operation" NOT NULL,
	"payload_fingerprint" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "squad_idempotency_receipts_actor_key_unique" UNIQUE("actor_id","key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "squad_memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"squad_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "squad_membership_role" NOT NULL,
	"legacy_room_id" uuid,
	"joined_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "squad_memberships_squad_user_unique" UNIQUE("squad_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "squads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legacy_room_id" uuid,
	"code" varchar(6) NOT NULL,
	"name" varchar(100) NOT NULL,
	"game_id" uuid NOT NULL,
	"state" "squad_lifecycle_state" NOT NULL,
	"max_members" integer NOT NULL,
	"discord_invitation" text NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"language" varchar(5) DEFAULT 'pt-br' NOT NULL,
	"last_membership_change_at" timestamp with time zone NOT NULL,
	"ready_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "squads_legacy_room_id_unique" UNIQUE("legacy_room_id"),
	CONSTRAINT "squads_code_unique" UNIQUE("code"),
	CONSTRAINT "squads_max_members_at_least_two" CHECK ("squads"."max_members" >= 2),
	CONSTRAINT "squads_ready_state_has_ready_at" CHECK (("squads"."state" <> 'ready' OR "squads"."ready_at" IS NOT NULL))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ready_notifications" ADD CONSTRAINT "ready_notifications_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ready_notifications" ADD CONSTRAINT "ready_notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squad_idempotency_receipts" ADD CONSTRAINT "squad_idempotency_receipts_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squad_memberships" ADD CONSTRAINT "squad_memberships_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squad_memberships" ADD CONSTRAINT "squad_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squad_memberships" ADD CONSTRAINT "squad_memberships_legacy_room_id_rooms_id_fk" FOREIGN KEY ("legacy_room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squads" ADD CONSTRAINT "squads_legacy_room_id_rooms_id_fk" FOREIGN KEY ("legacy_room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squads" ADD CONSTRAINT "squads_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Expand the canonical model without changing the legacy Room tables. The mapping is
-- intentionally narrow: only waiting rows are representable by the new lifecycle.
INSERT INTO "squads" (
	"id", "legacy_room_id", "code", "name", "game_id", "state", "max_members",
	"discord_invitation", "tags", "language", "last_membership_change_at", "ready_at",
	"expires_at", "created_at", "updated_at"
)
SELECT
	r."id",
	r."id",
	r."code",
	r."name",
	r."game_id",
	CASE WHEN r."completed_at" IS NULL THEN 'recruiting'::"squad_lifecycle_state" ELSE 'ready'::"squad_lifecycle_state" END,
	r."max_players",
	r."discord_link",
	r."tags",
	r."language",
	COALESCE(r."completed_at", r."updated_at"),
	r."completed_at",
	COALESCE(r."completed_at", r."updated_at") + INTERVAL '60 minutes',
	r."created_at",
	r."updated_at"
FROM "rooms" r
WHERE r."status" = 'waiting'
	AND r."discord_link" IS NOT NULL
ON CONFLICT ("legacy_room_id") DO NOTHING;
--> statement-breakpoint
-- A legacy owner is a Membership, even if an old data set omitted the matching
-- room_members row. This keeps every migrated Squad owned from its first read.
INSERT INTO "squad_memberships" (
	"id", "squad_id", "user_id", "role", "legacy_room_id", "joined_at"
)
SELECT
	gen_random_uuid(),
	s."id",
	rm."user_id",
	CASE WHEN rm."user_id" = r."host_id" THEN 'owner'::"squad_membership_role" ELSE 'member'::"squad_membership_role" END,
	r."id",
	rm."joined_at"
FROM "room_members" rm
INNER JOIN "rooms" r ON r."id" = rm."room_id"
INNER JOIN "squads" s ON s."legacy_room_id" = r."id"
ON CONFLICT ("squad_id", "user_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "squad_memberships" (
	"id", "squad_id", "user_id", "role", "legacy_room_id", "joined_at"
)
SELECT
	gen_random_uuid(),
	s."id",
	r."host_id",
	'owner'::"squad_membership_role",
	r."id",
	r."created_at"
FROM "rooms" r
INNER JOIN "squads" s ON s."legacy_room_id" = r."id"
LEFT JOIN "squad_memberships" sm ON sm."squad_id" = s."id" AND sm."user_id" = r."host_id"
WHERE sm."id" IS NULL;
--> statement-breakpoint
-- Preserve existing durable Room-ready notices in the new form. The original rows
-- remain untouched so the legacy notification flow continues to behave unchanged.
INSERT INTO "ready_notifications" (
	"id", "squad_id", "user_id", "readiness_at", "squad_code", "squad_name",
	"game_name", "discord_invitation", "legacy_notification_id", "read_at", "created_at"
)
SELECT
	un."id",
	s."id",
	un."user_id",
	s."ready_at",
	s."code",
	s."name",
	g."name",
	s."discord_invitation",
	un."id",
	un."read_at",
	un."created_at"
FROM "user_notifications" un
INNER JOIN "squads" s ON s."legacy_room_id" = CASE
	WHEN (un."payload" ->> 'roomId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
	THEN (un."payload" ->> 'roomId')::uuid
	ELSE NULL
END
INNER JOIN "games" g ON g."id" = s."game_id"
WHERE un."type" = 'room_ready'
	AND s."state" = 'ready'
ON CONFLICT ("legacy_notification_id") DO NOTHING;
--> statement-breakpoint
-- Playing and finished Room rows have no canonical lifecycle equivalent. They are
-- deliberately retained only in the legacy tables for manual resolution; do not
-- infer either as Recruiting or Ready. Rows without an invitation are likewise
-- retained because a Ready Squad may not expose a missing invitation as valid data.
DO $$
DECLARE
	skipped_playing_or_finished integer;
	skipped_without_invitation integer;
BEGIN
	SELECT count(*) INTO skipped_playing_or_finished
	FROM "rooms"
	WHERE "status" IN ('playing', 'finished');

	IF skipped_playing_or_finished > 0 THEN
		RAISE NOTICE 'SQU-6 migration retained % playing/finished legacy Room rows for manual resolution', skipped_playing_or_finished;
	END IF;

	SELECT count(*) INTO skipped_without_invitation
	FROM "rooms"
	WHERE "status" = 'waiting' AND "discord_link" IS NULL;

	IF skipped_without_invitation > 0 THEN
		RAISE NOTICE 'SQU-6 migration retained % legacy Room rows without a Discord invitation for manual resolution', skipped_without_invitation;
	END IF;
END $$;
--> statement-breakpoint
-- Canonical inserts must respect active Memberships migrated from Room as well as
-- other canonical Memberships. Legacy rows are allowed to overlap only because
-- the pre-contract Room flow permitted that historical state.
CREATE FUNCTION "enforce_one_active_canonical_squad_membership"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW."ended_at" IS NOT NULL OR NEW."legacy_room_id" IS NOT NULL THEN
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
CREATE TRIGGER "squad_memberships_one_active_membership_guard"
BEFORE INSERT OR UPDATE OF "user_id", "ended_at", "legacy_room_id"
ON "squad_memberships"
FOR EACH ROW
EXECUTE FUNCTION "enforce_one_active_canonical_squad_membership"();
--> statement-breakpoint
-- Calling this function inside the lifecycle transaction serializes final-slot
-- competition. The row lock remains held until that transaction commits or rolls
-- back, so membership creation, Ready transition, receipts, and notifications can
-- remain one atomic operation in the later vertical slices.
CREATE FUNCTION "lock_recruiting_squad_membership_slot"("target_squad_id" uuid)
RETURNS TABLE ("squad_id" uuid, "max_members" integer, "member_count" integer)
LANGUAGE plpgsql
AS $$
DECLARE
	locked_squad record;
	current_member_count integer;
BEGIN
	SELECT s."id", s."max_members"
	INTO locked_squad
	FROM "squads" s
	WHERE s."id" = target_squad_id
		AND s."state" = 'recruiting'
		AND s."ended_at" IS NULL
	FOR UPDATE;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Squad is not Recruiting' USING ERRCODE = 'P0001';
	END IF;

	SELECT count(*)::integer
	INTO current_member_count
	FROM "squad_memberships"
	WHERE "squad_id" = target_squad_id
		AND "ended_at" IS NULL;

	IF current_member_count >= locked_squad."max_members" THEN
		RAISE EXCEPTION 'Squad has reached capacity' USING ERRCODE = 'P0001';
	END IF;

	RETURN QUERY SELECT locked_squad."id", locked_squad."max_members", current_member_count;
END;
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "squad_memberships_one_active_canonical_membership_per_user" ON "squad_memberships" USING btree ("user_id") WHERE "squad_memberships"."ended_at" IS NULL AND "squad_memberships"."legacy_room_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "squad_memberships_one_active_owner_per_squad" ON "squad_memberships" USING btree ("squad_id") WHERE "squad_memberships"."role" = 'owner' AND "squad_memberships"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "squads_active_deadline_idx" ON "squads" USING btree ("state","expires_at");
