CREATE TABLE "studio" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"default_hourly_rate" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "studio_name_unique" ON "studio" USING btree ("name");