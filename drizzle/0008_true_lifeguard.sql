-- 1) Adicionar coluna chapters_version em book com default 0
ALTER TABLE "book" ADD COLUMN "chapters_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- 2) Adicionar title e position em chapter como nullable temporariamente para backfill
ALTER TABLE "chapter" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "chapter" ADD COLUMN "position" integer;--> statement-breakpoint

-- 3) Backfill title com 'Capítulo ' || number::text
UPDATE "chapter" SET "title" = 'Capítulo ' || "number"::text;--> statement-breakpoint

-- 4) Backfill position densificada por row_number sobre number existente
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY book_id ORDER BY number) - 1 AS new_position
  FROM "chapter"
)
UPDATE "chapter" c SET "position" = r.new_position
FROM ranked r WHERE c.id = r.id;--> statement-breakpoint

-- 5) Setar NOT NULL após backfill
ALTER TABLE "chapter" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chapter" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint

-- 6) Constraints novas em chapter
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_title_length" CHECK (length("chapter"."title") <= 100);--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_title_no_newline" CHECK ("chapter"."title" !~ E'[\n\r]');--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_position_nonnegative" CHECK ("chapter"."position" >= 0);--> statement-breakpoint

-- 7) Unique constraint DEFERRABLE INITIALLY DEFERRED em (book_id, position)
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_book_position_unique" UNIQUE ("book_id", "position") DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint

-- 8) Índice de leitura por (book_id, position)
CREATE INDEX "chapter_book_position_idx" ON "chapter" USING btree ("book_id","position");--> statement-breakpoint

-- 9) Remover artefatos da coluna number antiga
ALTER TABLE "chapter" DROP CONSTRAINT "chapter_number_positive";--> statement-breakpoint
DROP INDEX "chapter_book_number_unique";--> statement-breakpoint
ALTER TABLE "chapter" DROP COLUMN "number";
