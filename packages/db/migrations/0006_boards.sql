-- 0006 boards — multi-tenant rearchitecture (M1).
-- ONE transaction (drizzle wraps a migration file): create the board tables, add board_id
-- everywhere as NULLABLE, backfill all existing content onto the super-admin's board, then
-- SET NOT NULL. The backfill is data-conditional (WHERE ... IS NULL / role filters) so on the
-- empty up→down→up test container every DML statement is a no-op and SET NOT NULL trivially
-- passes. Prod rollback = the pg_dump backup (the down file exists only for the test).

-- 1. New enum + board tables --------------------------------------------------
CREATE TYPE "public"."board_member_role" AS ENUM('editor', 'viewer');--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text DEFAULT 'My board' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_members" (
	"board_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "board_member_role" NOT NULL,
	"show_furniture" boolean DEFAULT true NOT NULL,
	"invited_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "board_members_board_id_user_id_pk" PRIMARY KEY("board_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "board_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"token" text NOT NULL,
	"label" text,
	"show_furniture" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"revoked_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "board_shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"defaults" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_singleton" CHECK ("app_settings"."id" = 'global')
);
--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_shares" ADD CONSTRAINT "board_shares_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_shares" ADD CONSTRAINT "board_shares_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_members_user_idx" ON "board_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "board_shares_board_idx" ON "board_shares" USING btree ("board_id");--> statement-breakpoint
CREATE UNIQUE INDEX "boards_owner_id_key" ON "boards" USING btree ("owner_id");--> statement-breakpoint

-- 2. Instance role default: viewer → user ------------------------------------
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'user';--> statement-breakpoint

-- 3. entries.created_by → nullable + ON DELETE set null (authorship is metadata) ----
ALTER TABLE "entries" DROP CONSTRAINT "entries_created_by_user_id_fk";--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- 4. Add board_id (NULLABLE for now) + updated_by ----------------------------
ALTER TABLE "entries" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "strokes" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "frames" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "teleports" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "board_id" uuid;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "board_id" uuid;--> statement-breakpoint

-- 5. FKs for the new columns -------------------------------------------------
ALTER TABLE "entries" ADD CONSTRAINT "entries_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strokes" ADD CONSTRAINT "strokes_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frames" ADD CONSTRAINT "frames_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teleports" ADD CONSTRAINT "teleports_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- 6. Backfill (data-conditional; no-op on an empty DB) -----------------------
-- 6a. The super-admin's board = the earliest role='admin' user; existing global content is theirs.
INSERT INTO "boards" ("owner_id", "name")
	SELECT u.id, 'My board' FROM "user" u WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1
	ON CONFLICT ("owner_id") DO NOTHING;--> statement-breakpoint
-- 6b. Point every existing content row at that board.
UPDATE "entries" SET "board_id" = (SELECT b.id FROM "boards" b JOIN "user" u ON u.id = b.owner_id WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1) WHERE "board_id" IS NULL;--> statement-breakpoint
UPDATE "strokes" SET "board_id" = (SELECT b.id FROM "boards" b JOIN "user" u ON u.id = b.owner_id WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1) WHERE "board_id" IS NULL;--> statement-breakpoint
UPDATE "connections" SET "board_id" = (SELECT b.id FROM "boards" b JOIN "user" u ON u.id = b.owner_id WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1) WHERE "board_id" IS NULL;--> statement-breakpoint
UPDATE "frames" SET "board_id" = (SELECT b.id FROM "boards" b JOIN "user" u ON u.id = b.owner_id WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1) WHERE "board_id" IS NULL;--> statement-breakpoint
UPDATE "tags" SET "board_id" = (SELECT b.id FROM "boards" b JOIN "user" u ON u.id = b.owner_id WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1) WHERE "board_id" IS NULL;--> statement-breakpoint
UPDATE "teleports" SET "board_id" = (SELECT b.id FROM "boards" b JOIN "user" u ON u.id = b.owner_id WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1) WHERE "board_id" IS NULL;--> statement-breakpoint
UPDATE "assets" SET "board_id" = (SELECT b.id FROM "boards" b JOIN "user" u ON u.id = b.owner_id WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1) WHERE "board_id" IS NULL;--> statement-breakpoint
UPDATE "feedback" SET "board_id" = (SELECT b.id FROM "boards" b JOIN "user" u ON u.id = b.owner_id WHERE u.role = 'admin' ORDER BY u.created_at LIMIT 1) WHERE "board_id" IS NULL;--> statement-breakpoint
-- 6c. Editor attribution seeds from the author.
UPDATE "entries" SET "updated_by" = "created_by" WHERE "updated_by" IS NULL;--> statement-breakpoint
-- 6d. Legacy viewers → personal board + viewer membership on the super-admin board + role='user'.
INSERT INTO "boards" ("owner_id", "name")
	SELECT u.id, 'My board' FROM "user" u WHERE u.role = 'viewer'
	ON CONFLICT ("owner_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "board_members" ("board_id", "user_id", "role", "show_furniture")
	SELECT ab.id, u.id, 'viewer', true
	FROM "user" u
	CROSS JOIN (SELECT b.id FROM "boards" b JOIN "user" ua ON ua.id = b.owner_id WHERE ua.role = 'admin' ORDER BY ua.created_at LIMIT 1) ab
	WHERE u.role = 'viewer'
	ON CONFLICT ("board_id", "user_id") DO NOTHING;--> statement-breakpoint
UPDATE "user" SET "role" = 'user' WHERE "role" = 'viewer';--> statement-breakpoint
-- 6e. Global settings singleton.
INSERT INTO "app_settings" ("id") VALUES ('global') ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

-- 7. Enforce NOT NULL on board_id (all content assigned; feedback.board_id stays nullable) ----
ALTER TABLE "entries" ALTER COLUMN "board_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "strokes" ALTER COLUMN "board_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "board_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "frames" ALTER COLUMN "board_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "board_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teleports" ALTER COLUMN "board_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "board_id" SET NOT NULL;--> statement-breakpoint

-- 8. board_id indexes --------------------------------------------------------
CREATE INDEX "entries_board_idx" ON "entries" USING btree ("board_id","deleted_at");--> statement-breakpoint
CREATE INDEX "strokes_board_idx" ON "strokes" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "connections_board_idx" ON "connections" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "frames_board_idx" ON "frames" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "tags_board_idx" ON "tags" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "teleports_board_idx" ON "teleports" USING btree ("board_id");
