CREATE TABLE "book" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"studio_id" text NOT NULL,
	"price_per_hour" numeric(10, 2) NOT NULL,
	"pdf_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_price_per_hour_range" CHECK ("book"."price_per_hour" >= 0.01 AND "book"."price_per_hour" <= 9999.99),
	CONSTRAINT "book_pdf_url_format" CHECK ("book"."pdf_url" IS NULL OR (length("book"."pdf_url") <= 2048 AND "book"."pdf_url" ~* '^https?://'))
);
--> statement-breakpoint
CREATE TABLE "chapter" (
	"id" text PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"number" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"narrator_id" text,
	"editor_id" text,
	"edited_hours" numeric(5, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chapter_number_positive" CHECK ("chapter"."number" >= 1),
	CONSTRAINT "chapter_edited_hours_range" CHECK ("chapter"."edited_hours" >= 0 AND "chapter"."edited_hours" <= 999.99)
);
--> statement-breakpoint
DROP INDEX "editor_name_unique";--> statement-breakpoint
DROP INDEX "narrator_name_unique";--> statement-breakpoint
DROP INDEX "studio_name_unique";--> statement-breakpoint
ALTER TABLE "editor" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "narrator" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "studio" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
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
CREATE INDEX "chapter_book_status_idx" ON "chapter" USING btree ("book_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "editor_name_unique_active" ON "editor" USING btree (lower("name")) WHERE "editor"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "editor_deleted_at_idx" ON "editor" USING btree ("deleted_at") WHERE "editor"."deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "narrator_name_unique_active" ON "narrator" USING btree (lower("name")) WHERE "narrator"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "narrator_deleted_at_idx" ON "narrator" USING btree ("deleted_at") WHERE "narrator"."deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "studio_name_unique_active" ON "studio" USING btree (lower("name")) WHERE "studio"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "studio_deleted_at_idx" ON "studio" USING btree ("deleted_at") WHERE "studio"."deleted_at" IS NOT NULL;