DROP INDEX "narrator_email_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "narrator_name_unique" ON "narrator" USING btree ("name");--> statement-breakpoint
ALTER TABLE "narrator" DROP COLUMN "email";