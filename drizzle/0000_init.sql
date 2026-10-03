CREATE TYPE "public"."caregiver_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."convo_status" AS ENUM('recording', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."created_via" AS ENUM('caregiver', 'patient_device', 'seed');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('skipped', 'pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."device_kind" AS ENUM('patient_display', 'patient_phone', 'webcam', 'earpiece', 'smart_speaker', 'led_display', 'other');--> statement-breakpoint
CREATE TYPE "public"."embedding_source" AS ENUM('upload', 'webcam_capture');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('confused_pressed', 'calming_music', 'calming_memories', 'question_asked', 'who_is_this', 'memories_opened', 'listen_started');--> statement-breakpoint
CREATE TYPE "public"."geofence_kind" AS ENUM('home', 'temporary');--> statement-breakpoint
CREATE TYPE "public"."geofence_state" AS ENUM('unknown', 'inside', 'outside');--> statement-breakpoint
CREATE TYPE "public"."location_source" AS ENUM('browser', 'shortcut', 'simulated', 'device');--> statement-breakpoint
CREATE TYPE "public"."memory_kind" AS ENUM('note', 'photo', 'story');--> statement-breakpoint
CREATE TYPE "public"."notif_kind" AS ENUM('geofence_exit', 'geofence_return', 'person_pending', 'test');--> statement-breakpoint
CREATE TYPE "public"."person_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."recog_source" AS ENUM('face', 'voice', 'manual');--> statement-breakpoint
CREATE TYPE "public"."schedule_kind" AS ENUM('visit', 'activity', 'therapy', 'meal', 'other');--> statement-breakpoint
CREATE TABLE "alert_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"notify_geofence" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_contacts_patient_id_phone_e164_unique" UNIQUE("patient_id","phone_e164"),
	CONSTRAINT "alert_contacts_phone_check" CHECK ("alert_contacts"."phone_e164" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "caregivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"phone_e164" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "caregivers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "conversation_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"transcript" text,
	"status" "convo_status" DEFAULT 'processing' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_chunks_conversation_id_seq_unique" UNIQUE("conversation_id","seq")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"person_id" uuid,
	"status" "convo_status" DEFAULT 'recording' NOT NULL,
	"transcript" text DEFAULT '' NOT NULL,
	"summary" text,
	"key_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"speaker_claim" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" "device_kind" NOT NULL,
	"label" text NOT NULL,
	"token_hash" text NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "face_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"model" text NOT NULL,
	"dim" integer NOT NULL,
	"embedding" real[] NOT NULL,
	"source" "embedding_source" NOT NULL,
	"media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "face_embeddings_dim_check" CHECK (array_length("face_embeddings"."embedding", 1) = "face_embeddings"."dim")
);
--> statement-breakpoint
CREATE TABLE "geofences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" "geofence_kind" NOT NULL,
	"label" text NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lng" double precision NOT NULL,
	"radius_m" integer NOT NULL,
	"active_from" timestamp with time zone,
	"active_until" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "geofences_radius_m_check" CHECK ("geofences"."radius_m" between 50 and 20000),
	CONSTRAINT "geofences_window_check" CHECK ("geofences"."kind" = 'home' or ("geofences"."active_from" is not null and "geofences"."active_until" is not null and "geofences"."active_until" > "geofences"."active_from"))
);
--> statement-breakpoint
CREATE TABLE "location_pings" (
	"patient_id" uuid NOT NULL,
	"device_id" uuid,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"accuracy_m" real,
	"source" "location_source" NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_pings_lat_check" CHECK ("location_pings"."lat" between -90 and 90),
	CONSTRAINT "location_pings_lng_check" CHECK ("location_pings"."lng" between -180 and 180)
);
--> statement-breakpoint
CREATE TABLE "media_blobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_blobs_patient_id_sha256_unique" UNIQUE("patient_id","sha256"),
	CONSTRAINT "media_blobs_size_check" CHECK ("media_blobs"."size_bytes" <= 2000000)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" "notif_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"photon_status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"photon_attempts" integer DEFAULT 0 NOT NULL,
	"photon_last_error" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "pairing_codes" (
	"code" char(6) PRIMARY KEY NOT NULL,
	"patient_id" uuid NOT NULL,
	"device_kind" "device_kind" NOT NULL,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "patient_caregivers" (
	"patient_id" uuid NOT NULL,
	"caregiver_id" uuid NOT NULL,
	"role" "caregiver_role" DEFAULT 'owner' NOT NULL,
	CONSTRAINT "patient_caregivers_patient_id_caregiver_id_pk" PRIMARY KEY("patient_id","caregiver_id")
);
--> statement-breakpoint
CREATE TABLE "patient_events" (
	"patient_id" uuid NOT NULL,
	"device_id" uuid,
	"kind" "event_kind" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"preferred_name" text NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"home_label" text DEFAULT 'Home' NOT NULL,
	"home_lat" double precision,
	"home_lng" double precision,
	"geofence_state" "geofence_state" DEFAULT 'unknown' NOT NULL,
	"geofence_state_changed_at" timestamp with time zone,
	"outside_streak" integer DEFAULT 0 NOT NULL,
	"last_location_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"status" "person_status" DEFAULT 'pending' NOT NULL,
	"name" text,
	"relationship" text,
	"spoken_name" text,
	"description" text,
	"visit_routine" text,
	"narration" jsonb,
	"narration_hash" text,
	"primary_photo_id" uuid,
	"created_via" "created_via" NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_approved_fields_check" CHECK ("people"."status" <> 'approved' or ("people"."name" is not null and "people"."relationship" is not null))
);
--> statement-breakpoint
CREATE TABLE "person_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" "memory_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"media_id" uuid,
	"occurred_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recognition_events" (
	"patient_id" uuid NOT NULL,
	"device_id" uuid,
	"person_id" uuid,
	"source" "recog_source" NOT NULL,
	"confidence" real NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recognition_events_confidence_check" CHECK ("recognition_events"."confidence" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "schedule_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" "schedule_kind" NOT NULL,
	"title" text NOT NULL,
	"person_id" uuid,
	"starts_at" timestamp with time zone,
	"days_of_week" smallint[],
	"start_time" time,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_items_duration_check" CHECK ("schedule_items"."duration_min" between 5 and 720),
	CONSTRAINT "schedule_items_style_check" CHECK (("schedule_items"."starts_at" is not null) <> ("schedule_items"."days_of_week" is not null and "schedule_items"."start_time" is not null))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"caregiver_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tts_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"provider" text NOT NULL,
	"media_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "alert_contacts" ADD CONSTRAINT "alert_contacts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_chunks" ADD CONSTRAINT "conversation_chunks_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "face_embeddings" ADD CONSTRAINT "face_embeddings_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "face_embeddings" ADD CONSTRAINT "face_embeddings_media_id_media_blobs_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_blobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_blobs" ADD CONSTRAINT "media_blobs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_created_by_caregivers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."caregivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_caregivers" ADD CONSTRAINT "patient_caregivers_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_caregivers" ADD CONSTRAINT "patient_caregivers_caregiver_id_caregivers_id_fk" FOREIGN KEY ("caregiver_id") REFERENCES "public"."caregivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_events" ADD CONSTRAINT "patient_events_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_events" ADD CONSTRAINT "patient_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_primary_photo_id_media_blobs_id_fk" FOREIGN KEY ("primary_photo_id") REFERENCES "public"."media_blobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_approved_by_caregivers_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."caregivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_memories" ADD CONSTRAINT "person_memories_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_memories" ADD CONSTRAINT "person_memories_media_id_media_blobs_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_blobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_events" ADD CONSTRAINT "recognition_events_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_events" ADD CONSTRAINT "recognition_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_events" ADD CONSTRAINT "recognition_events_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_caregiver_id_caregivers_id_fk" FOREIGN KEY ("caregiver_id") REFERENCES "public"."caregivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tts_cache" ADD CONSTRAINT "tts_cache_media_id_media_blobs_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_blobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_person_id_started_at_index" ON "conversations" USING btree ("person_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "devices_patient_id_index" ON "devices" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "face_embeddings_person_id_index" ON "face_embeddings" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_home_fence" ON "geofences" USING btree ("patient_id") WHERE "geofences"."kind" = 'home';--> statement-breakpoint
CREATE INDEX "geofences_patient_id_is_active_index" ON "geofences" USING btree ("patient_id","is_active");--> statement-breakpoint
CREATE INDEX "notifications_patient_id_created_at_index" ON "notifications" USING btree ("patient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_pending_idx" ON "notifications" USING btree ("photon_status") WHERE "notifications"."photon_status" = 'pending';--> statement-breakpoint
CREATE INDEX "patient_caregivers_caregiver_id_index" ON "patient_caregivers" USING btree ("caregiver_id");--> statement-breakpoint
CREATE INDEX "people_patient_id_status_index" ON "people" USING btree ("patient_id","status");--> statement-breakpoint
CREATE INDEX "person_memories_person_id_index" ON "person_memories" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "questions_patient_id_sort_order_index" ON "questions" USING btree ("patient_id","sort_order");--> statement-breakpoint
CREATE INDEX "schedule_items_patient_id_index" ON "schedule_items" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "sessions_caregiver_id_index" ON "sessions" USING btree ("caregiver_id");--> statement-breakpoint
CREATE INDEX "visits_patient_id_started_at_index" ON "visits" USING btree ("patient_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "visits_person_id_started_at_index" ON "visits" USING btree ("person_id","started_at" DESC NULLS LAST);