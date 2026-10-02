-- Down for 0007: revert feedback kind/status enums back to text + drop the created_by FK.
-- Restores the pre-0007 shape on the test container (the pg_dump backup is the prod rollback).
ALTER TABLE "feedback" DROP CONSTRAINT IF EXISTS "feedback_created_by_user_id_fk";
ALTER TABLE "feedback" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "feedback" ALTER COLUMN "kind" SET DATA TYPE text USING "kind"::text;
ALTER TABLE "feedback" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;
ALTER TABLE "feedback" ALTER COLUMN "status" SET DEFAULT 'open';
DROP TYPE IF EXISTS "public"."feedback_kind";
DROP TYPE IF EXISTS "public"."feedback_status";
