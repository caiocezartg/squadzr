ALTER TABLE "rooms" ADD COLUMN "discord_call_id" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "discord_call_name" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_discord_call_both_or_neither" CHECK (("rooms"."discord_call_id" IS NULL) = ("rooms"."discord_call_name" IS NULL));