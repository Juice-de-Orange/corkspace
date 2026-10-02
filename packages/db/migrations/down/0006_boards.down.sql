-- Down for 0006: undo the multi-tenant board model. Restores the pre-0006 shape on the empty
-- test container (entries.created_by back to NOT NULL + restrict; user.role default back to
-- 'viewer'). Not used as a prod rollback (the pg_dump backup is).

-- board_id indexes
DROP INDEX IF EXISTS "entries_board_idx";
DROP INDEX IF EXISTS "strokes_board_idx";
DROP INDEX IF EXISTS "connections_board_idx";
DROP INDEX IF EXISTS "frames_board_idx";
DROP INDEX IF EXISTS "tags_board_idx";
DROP INDEX IF EXISTS "teleports_board_idx";

-- board_id / updated_by FKs
ALTER TABLE "entries" DROP CONSTRAINT IF EXISTS "entries_board_id_boards_id_fk";
ALTER TABLE "entries" DROP CONSTRAINT IF EXISTS "entries_updated_by_user_id_fk";
ALTER TABLE "strokes" DROP CONSTRAINT IF EXISTS "strokes_board_id_boards_id_fk";
ALTER TABLE "connections" DROP CONSTRAINT IF EXISTS "connections_board_id_boards_id_fk";
ALTER TABLE "frames" DROP CONSTRAINT IF EXISTS "frames_board_id_boards_id_fk";
ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_board_id_boards_id_fk";
ALTER TABLE "teleports" DROP CONSTRAINT IF EXISTS "teleports_board_id_boards_id_fk";
ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_board_id_boards_id_fk";
ALTER TABLE "feedback" DROP CONSTRAINT IF EXISTS "feedback_board_id_boards_id_fk";

-- board_id / updated_by columns
ALTER TABLE "entries" DROP COLUMN IF EXISTS "board_id";
ALTER TABLE "entries" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "strokes" DROP COLUMN IF EXISTS "board_id";
ALTER TABLE "connections" DROP COLUMN IF EXISTS "board_id";
ALTER TABLE "frames" DROP COLUMN IF EXISTS "board_id";
ALTER TABLE "tags" DROP COLUMN IF EXISTS "board_id";
ALTER TABLE "teleports" DROP COLUMN IF EXISTS "board_id";
ALTER TABLE "assets" DROP COLUMN IF EXISTS "board_id";
ALTER TABLE "feedback" DROP COLUMN IF EXISTS "board_id";

-- entries.created_by back to NOT NULL + ON DELETE restrict
ALTER TABLE "entries" DROP CONSTRAINT IF EXISTS "entries_created_by_user_id_fk";
ALTER TABLE "entries" ALTER COLUMN "created_by" SET NOT NULL;
ALTER TABLE "entries" ADD CONSTRAINT "entries_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;

-- role default back to 'viewer'
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'viewer';

-- new tables (children first) + enum
DROP TABLE IF EXISTS "board_members";
DROP TABLE IF EXISTS "board_shares";
DROP TABLE IF EXISTS "app_settings";
DROP TABLE IF EXISTS "boards";
DROP TYPE IF EXISTS "public"."board_member_role";
