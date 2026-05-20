-- Down migration (manual reference, Drizzle does not auto-generate):
--   DROP INDEX "chapter_paid_at_idx";
--   DROP INDEX "chapter_completed_at_idx";
--   ALTER TABLE "user_preference" DROP COLUMN "dashboard_widgets";
--   ALTER TABLE "chapter" DROP COLUMN "paid_at";
--   ALTER TABLE "chapter" DROP COLUMN "completed_at";

ALTER TABLE "chapter" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chapter" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "dashboard_widgets" jsonb DEFAULT '["a-receber-agora","receita-periodo","ticket-medio","ranking-estudio","ranking-narrador","ranking-editor","funil-status","atrasados","grafico-receita"]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "chapter_completed_at_idx" ON "chapter" USING btree ("completed_at") WHERE "chapter"."completed_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "chapter_paid_at_idx" ON "chapter" USING btree ("paid_at") WHERE "chapter"."paid_at" IS NOT NULL;--> statement-breakpoint
UPDATE "chapter" SET "completed_at" = "updated_at" WHERE "status" IN ('completed', 'paid') AND "completed_at" IS NULL;--> statement-breakpoint
UPDATE "chapter" SET "paid_at" = "updated_at" WHERE "status" = 'paid' AND "paid_at" IS NULL;
