ALTER TABLE "chapter" ADD COLUMN "deadline" date;--> statement-breakpoint
CREATE INDEX "chapter_deadline_active_idx" ON "chapter" USING btree ("deadline") WHERE "chapter"."deadline" IS NOT NULL;