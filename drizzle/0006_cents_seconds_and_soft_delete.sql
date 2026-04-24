-- ============================================================
-- Feature 020: CRUD de Livros e Capítulos
-- Constitution v2.13.0 — integer cents/seconds + soft-delete
-- ============================================================

-- ----- 1. book --------------------------------------------------------------
CREATE TABLE "book" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"studio_id" text NOT NULL,
	"price_per_hour_cents" integer NOT NULL,
	"pdf_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_price_per_hour_cents_range" CHECK ("book"."price_per_hour_cents" >= 1 AND "book"."price_per_hour_cents" <= 999999),
	CONSTRAINT "book_pdf_url_format" CHECK ("book"."pdf_url" IS NULL OR (length("book"."pdf_url") <= 2048 AND "book"."pdf_url" ~* '^https?://'))
);
--> statement-breakpoint

-- ----- 2. chapter -----------------------------------------------------------
CREATE TABLE "chapter" (
	"id" text PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"number" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"narrator_id" text,
	"editor_id" text,
	"edited_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chapter_number_positive" CHECK ("chapter"."number" >= 1),
	CONSTRAINT "chapter_edited_seconds_range" CHECK ("chapter"."edited_seconds" >= 0 AND "chapter"."edited_seconds" <= 3600000)
);
--> statement-breakpoint

-- ----- 3. studio: rate → cents + soft-delete -------------------------------
ALTER TABLE "studio" ADD COLUMN "default_hourly_rate_cents" integer;--> statement-breakpoint
UPDATE "studio" SET "default_hourly_rate_cents" = ROUND("default_hourly_rate" * 100)::integer;--> statement-breakpoint
ALTER TABLE "studio" ALTER COLUMN "default_hourly_rate_cents" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "studio" DROP COLUMN "default_hourly_rate";--> statement-breakpoint
ALTER TABLE "studio" ADD CONSTRAINT "studio_default_hourly_rate_cents_range" CHECK ("studio"."default_hourly_rate_cents" >= 1 AND "studio"."default_hourly_rate_cents" <= 999999);--> statement-breakpoint
ALTER TABLE "studio" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
DROP INDEX "studio_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "studio_name_unique_active" ON "studio" USING btree (lower("name")) WHERE "studio"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "studio_deleted_at_idx" ON "studio" USING btree ("deleted_at") WHERE "studio"."deleted_at" IS NOT NULL;--> statement-breakpoint

-- ----- 4. narrator: soft-delete --------------------------------------------
ALTER TABLE "narrator" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
DROP INDEX "narrator_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "narrator_name_unique_active" ON "narrator" USING btree (lower("name")) WHERE "narrator"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "narrator_deleted_at_idx" ON "narrator" USING btree ("deleted_at") WHERE "narrator"."deleted_at" IS NOT NULL;--> statement-breakpoint

-- ----- 5. editor: soft-delete ----------------------------------------------
ALTER TABLE "editor" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
DROP INDEX "editor_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "editor_name_unique_active" ON "editor" USING btree (lower("name")) WHERE "editor"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "editor_deleted_at_idx" ON "editor" USING btree ("deleted_at") WHERE "editor"."deleted_at" IS NOT NULL;--> statement-breakpoint

-- ----- 6. book/chapter foreign keys + indexes ------------------------------
ALTER TABLE "book" ADD CONSTRAINT "book_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_narrator_id_narrator_id_fk" FOREIGN KEY ("narrator_id") REFERENCES "public"."narrator"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_editor_id_editor_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."editor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_studio_id_idx" ON "book" USING btree ("studio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "book_title_studio_unique" ON "book" USING btree (lower("title"),"studio_id");--> statement-breakpoint
CREATE INDEX "book_created_at_idx" ON "book" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_book_number_unique" ON "chapter" USING btree ("book_id","number");--> statement-breakpoint
CREATE INDEX "chapter_book_id_idx" ON "chapter" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "chapter_narrator_id_idx" ON "chapter" USING btree ("narrator_id") WHERE "chapter"."narrator_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "chapter_editor_id_idx" ON "chapter" USING btree ("editor_id") WHERE "chapter"."editor_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "chapter_book_status_idx" ON "chapter" USING btree ("book_id","status");
