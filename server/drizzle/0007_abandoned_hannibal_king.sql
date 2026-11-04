CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "aliases" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "search_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE games SET search_text = trim(regexp_replace(lower(unaccent(name)), '[^[:alnum:]]+', ' ', 'g'));--> statement-breakpoint
ALTER TABLE games ALTER COLUMN search_text DROP DEFAULT;--> statement-breakpoint
CREATE INDEX games_search_text_trgm_idx ON games USING gin (search_text gin_trgm_ops);
