CREATE TABLE "editor" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "editor_name_unique" ON "editor" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "editor_email_unique" ON "editor" USING btree ("email");