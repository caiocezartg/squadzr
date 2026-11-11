CREATE TABLE IF NOT EXISTS "catalog_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" varchar(20) NOT NULL,
	"requested_by_id" text,
	"requested_by_name" text,
	"status" varchar(20) NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"created" integer,
	"updated" integer,
	"delisted" integer,
	"relisted" integer,
	"received" integer,
	"dropped" integer,
	"invalid" integer,
	"listed_games" integer,
	"error_message" text,
	CONSTRAINT "catalog_import_runs_trigger_in_enum" CHECK ("catalog_import_runs"."trigger" IN ('scheduled', 'manual')),
	CONSTRAINT "catalog_import_runs_status_in_enum" CHECK ("catalog_import_runs"."status" IN ('requested', 'running', 'succeeded', 'safety_stop', 'failed', 'interrupted'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "catalog_import_runs" ADD CONSTRAINT "catalog_import_runs_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_import_runs_single_active_idx" ON "catalog_import_runs" USING btree ((true)) WHERE "catalog_import_runs"."status" IN ('requested', 'running');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalog_import_runs_requested_at_idx" ON "catalog_import_runs" USING btree ("requested_at" DESC NULLS LAST,"id" DESC NULLS LAST);