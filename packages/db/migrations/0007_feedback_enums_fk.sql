CREATE TYPE "public"."feedback_kind" AS ENUM('bug', 'wish');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('open', 'done');--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "kind" SET DATA TYPE "feedback_kind" USING "kind"::"feedback_kind";--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "status" SET DATA TYPE "feedback_status" USING "status"::"feedback_status";--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint
UPDATE "feedback" SET "created_by" = NULL WHERE "created_by" IS NOT NULL AND "created_by" NOT IN (SELECT "id" FROM "user");--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
