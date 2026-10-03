import { z } from "zod";
import { uuid } from "./common";

export const recognitionBody = z.object({
  personId: uuid.nullable(),
  confidence: z.number().min(0).max(1),
  source: z.enum(["face", "manual"]),
});

export const eventKinds = [
  "confused_pressed",
  "calming_music",
  "calming_memories",
  "question_asked",
  "who_is_this",
  "memories_opened",
  "listen_started",
] as const;
export type EventKind = (typeof eventKinds)[number];

export const eventBody = z.object({
  kind: z.enum(eventKinds),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const deviceStatusBody = z.object({
  camera: z.enum(["ok", "denied", "unavailable", "error"]).optional(),
  microphone: z.enum(["ok", "denied", "unavailable", "error"]).optional(),
  faceModel: z.enum(["ok", "loading", "error"]).optional(),
  geolocation: z.enum(["ok", "denied", "unavailable", "error"]).optional(),
  /** IANA timezone of the patient's own device; the display keeps the patient's timezone in sync. */
  timezone: z.string().max(60).optional(),
});

export type PersonCardDto = {
  personId: string;
  name: string;
  relationship: string;
  photoUrl: string | null;
  recap: string;
  sayText: string;
  visitId: string;
};

export type GalleryResponse = {
  model: string;
  /** Match threshold for this patient's display. */
  threshold: number;
  people: { personId: string; name: string; relationship: string; photoUrl: string | null; embeddings: number[][] }[];
};

export type PatientPerson = { personId: string; name: string; relationship: string; photoUrl: string | null };
