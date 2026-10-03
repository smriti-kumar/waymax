CREATE TYPE "public"."date_kind" AS ENUM('birthday', 'anniversary', 'other');--> statement-breakpoint
CREATE TABLE "person_dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" date_kind NOT NULL,
	"label" text,
	"month" smallint NOT NULL,
	"day" smallint NOT NULL,
	"year" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_dates_month_check" CHECK ("person_dates"."month" between 1 and 12),
	CONSTRAINT "person_dates_day_check" CHECK ("person_dates"."day" between 1 and 31),
	CONSTRAINT "person_dates_year_check" CHECK ("person_dates"."year" is null or "person_dates"."year" between 1900 and 2100)
);
--> statement-breakpoint
ALTER TABLE "person_dates" ADD CONSTRAINT "person_dates_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "person_dates_person_id_index" ON "person_dates" USING btree ("person_id");