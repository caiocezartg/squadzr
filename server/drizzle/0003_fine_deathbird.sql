-- CCC-35: dispose of room lifecycle records before the schema conversion.
-- Only rooms, their memberships, and room_ready notifications are deleted;
-- users, accounts, sessions, and any other notification history are preserved.
DELETE FROM "room_members";--> statement-breakpoint
DELETE FROM "rooms";--> statement-breakpoint
DELETE FROM "user_notifications" WHERE "type" = 'room_ready';--> statement-breakpoint
ALTER TABLE "rooms" RENAME COLUMN "completed_at" TO "ready_at";--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN IF EXISTS "ready_notified_at";--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_room_user_type_unique" UNIQUE("room_id","user_id","type");--> statement-breakpoint
DROP TYPE "public"."room_status";--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_ready_after_created" CHECK ("rooms"."ready_at" IS NULL OR "rooms"."ready_at" >= "rooms"."created_at");--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_last_activity_after_created" CHECK ("rooms"."last_activity_at" >= "rooms"."created_at");--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_ready_after_last_activity" CHECK ("rooms"."ready_at" IS NULL OR "rooms"."ready_at" >= "rooms"."last_activity_at");