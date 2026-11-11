-- CCC-88: widen the catalog so it can hold imported IGDB games.
-- Rows that predate the catalog import become legacy entries: delisted, with no
-- IGDB identity and no genres, still referenced by the Squads that use them.
ALTER TABLE "games" ALTER COLUMN "name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "igdb_id" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "genres" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
UPDATE "games" SET "thumbnail_url" = "cover_url";--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "thumbnail_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "popularity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "listed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE "games" SET "listed" = false;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "featured_rank" integer;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_igdb_id_unique" UNIQUE("igdb_id");
