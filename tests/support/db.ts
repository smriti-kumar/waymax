import { describe } from "vitest";
import { sqlClient } from "@/server/db/client";

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

/** `describe` that skips (with a logged reason) when no test database is configured. */
export const describeDb = hasTestDb ? describe : describe.skip;

const TABLES = [
  "caregivers", "sessions", "patients", "patient_caregivers", "devices", "pairing_codes", "geofences",
  "alert_contacts", "media_blobs", "people", "face_embeddings", "person_memories", "visits", "conversations",
  "conversation_chunks", "schedule_items", "questions", "notifications", "tts_cache", "location_pings",
  "patient_events", "recognition_events", "person_dates",
];

export async function truncateAll() {
  await sqlClient().unsafe(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}
