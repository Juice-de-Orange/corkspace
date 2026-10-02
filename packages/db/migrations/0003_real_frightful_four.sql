CREATE TYPE "public"."stroke_tool" AS ENUM('pen', 'marker', 'line', 'arrow', 'rect');--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_entry_id" uuid NOT NULL,
	"to_entry_id" uuid NOT NULL,
	"color" text DEFAULT '#dc2626' NOT NULL,
	"label" text,
	"arrow_start" boolean DEFAULT false NOT NULL,
	"arrow_end" boolean DEFAULT true NOT NULL,
	"curve_style" text DEFAULT 'bezier' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strokes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid,
	"points" jsonb NOT NULL,
	"color" text NOT NULL,
	"size" real NOT NULL,
	"tool" "stroke_tool" DEFAULT 'pen' NOT NULL,
	"min_x" double precision NOT NULL,
	"min_y" double precision NOT NULL,
	"max_x" double precision NOT NULL,
	"max_y" double precision NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_from_entry_id_entries_id_fk" FOREIGN KEY ("from_entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_to_entry_id_entries_id_fk" FOREIGN KEY ("to_entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strokes" ADD CONSTRAINT "strokes_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strokes" ADD CONSTRAINT "strokes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connections_from_idx" ON "connections" USING btree ("from_entry_id");--> statement-breakpoint
CREATE INDEX "connections_to_idx" ON "connections" USING btree ("to_entry_id");--> statement-breakpoint
CREATE INDEX "strokes_entry_idx" ON "strokes" USING btree ("entry_id");