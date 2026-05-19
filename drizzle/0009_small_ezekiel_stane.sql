ALTER TABLE "book" ADD CONSTRAINT "book_title_length" CHECK (length("book"."title") >= 1 AND length("book"."title") <= 255);--> statement-breakpoint
ALTER TABLE "editor" ADD CONSTRAINT "editor_name_length" CHECK (length("editor"."name") >= 2 AND length("editor"."name") <= 100);--> statement-breakpoint
ALTER TABLE "editor" ADD CONSTRAINT "editor_email_length" CHECK (length("editor"."email") >= 1 AND length("editor"."email") <= 255);--> statement-breakpoint
ALTER TABLE "narrator" ADD CONSTRAINT "narrator_name_length" CHECK (length("narrator"."name") >= 2 AND length("narrator"."name") <= 100);--> statement-breakpoint
ALTER TABLE "studio" ADD CONSTRAINT "studio_name_length" CHECK (length("studio"."name") >= 2 AND length("studio"."name") <= 100);