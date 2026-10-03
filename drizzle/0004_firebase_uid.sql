ALTER TABLE "caregivers" ADD COLUMN "firebase_uid" text;--> statement-breakpoint
ALTER TABLE "caregivers" ADD CONSTRAINT "caregivers_firebase_uid_unique" UNIQUE("firebase_uid");