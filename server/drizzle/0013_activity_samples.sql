CREATE TABLE IF NOT EXISTS "activity_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sampled_at" timestamp with time zone NOT NULL,
	"online_users" integer NOT NULL,
	"open_squads" integer NOT NULL,
	CONSTRAINT "activity_samples_counts_not_negative" CHECK ("activity_samples"."online_users" >= 0 AND "activity_samples"."open_squads" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_samples_sampled_at_idx" ON "activity_samples" USING btree ("sampled_at");