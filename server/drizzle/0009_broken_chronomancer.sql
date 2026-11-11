CREATE TABLE IF NOT EXISTS "squad_record_members" (
	"record_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	CONSTRAINT "squad_record_members_record_id_user_id_pk" PRIMARY KEY("record_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "squad_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"platform" text,
	"host_id" text,
	"max_players" integer NOT NULL,
	"ready_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "squad_records_room_id_unique" UNIQUE("room_id"),
	CONSTRAINT "squad_records_platform_in_enum" CHECK ("squad_records"."platform" IS NULL OR "squad_records"."platform" IN ('pc', 'ps5', 'ps4', 'xbox-series', 'xbox-one', 'switch-2', 'switch', 'mobile'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squad_record_members" ADD CONSTRAINT "squad_record_members_record_id_squad_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."squad_records"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squad_record_members" ADD CONSTRAINT "squad_record_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squad_records" ADD CONSTRAINT "squad_records_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squad_records" ADD CONSTRAINT "squad_records_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "squad_record_members_user_idx" ON "squad_record_members" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "squad_records" ("room_id", "game_id", "name", "platform", "host_id", "max_players", "ready_at")
SELECT "r"."id", "r"."game_id", "r"."name", "r"."platform", "r"."host_id", "r"."max_players", "r"."ready_at"
FROM "rooms" "r"
WHERE "r"."ready_at" IS NOT NULL
ON CONFLICT ("room_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "squad_record_members" ("record_id", "user_id", "joined_at")
SELECT "sr"."id", "rm"."user_id", "rm"."joined_at"
FROM "room_members" "rm"
INNER JOIN "rooms" "r" ON "r"."id" = "rm"."room_id" AND "r"."ready_at" IS NOT NULL
INNER JOIN "squad_records" "sr" ON "sr"."room_id" = "r"."id"
ON CONFLICT DO NOTHING;
