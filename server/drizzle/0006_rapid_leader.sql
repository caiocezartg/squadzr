ALTER TABLE "games" ADD COLUMN "platforms" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_platform_in_enum" CHECK ("rooms"."platform" IS NULL OR "rooms"."platform" IN ('pc', 'ps5', 'ps4', 'xbox-series', 'xbox-one', 'switch-2', 'switch', 'mobile'));