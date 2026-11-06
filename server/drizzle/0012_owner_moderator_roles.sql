ALTER TABLE "user" DROP CONSTRAINT "user_role_in_enum";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_single_owner_idx" ON "user" USING btree ("role") WHERE "user"."role" = 'owner';--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_in_enum" CHECK ("user"."role" IN ('user', 'moderator', 'admin', 'owner'));