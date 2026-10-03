import { z } from "zod";
import { nonEmpty, optionalText, uuid } from "./common";

export const createPersonBody = z.object({
  name: nonEmpty(80),
  relationship: nonEmpty(60),
  spokenName: optionalText(80),
  description: optionalText(1000),
  visitRoutine: optionalText(300),
});

export const patchPersonBody = z
  .object({
    name: nonEmpty(80),
    relationship: nonEmpty(60),
    spokenName: optionalText(80),
    description: optionalText(1000),
    visitRoutine: optionalText(300),
    primaryPhotoId: uuid.nullable(),
    status: z.enum(["approved", "rejected"]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const peopleQuery = z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() });

export const memoryBody = z.object({
  kind: z.enum(["note", "photo", "story"]),
  title: nonEmpty(120),
  body: optionalText(2000),
  mediaId: uuid.nullish().transform((v) => v ?? null),
  occurredOn: z.iso
    .date()
    .nullish()
    .transform((v) => v ?? null),
});
export const patchMemoryBody = memoryBody.partial().refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const embeddingsBody = z.object({
  items: z
    .array(
      z.object({
        vector: z.array(z.number().finite()).min(16).max(4096),
        dim: z.number().int().positive(),
        model: z.string().min(1).max(60),
        mediaId: uuid.nullish(),
      }),
    )
    .min(1)
    .max(20),
});

export type PersonStatus = "pending" | "approved" | "rejected";

export type PersonSummary = {
  id: string;
  status: PersonStatus;
  name: string | null;
  relationship: string | null;
  spokenName: string | null;
  description: string | null;
  visitRoutine: string | null;
  photoUrl: string | null;
  primaryPhotoId: string | null;
  embeddingCount: number;
  createdVia: "caregiver" | "patient_device" | "seed";
  createdAt: string;
};

export type MemoryDto = {
  id: string;
  kind: "note" | "photo" | "story";
  title: string;
  body: string | null;
  mediaId: string | null;
  photoUrl: string | null;
  occurredOn: string | null;
};

export type PersonDetail = {
  person: PersonSummary;
  photos: { mediaId: string; url: string; hasEmbedding: boolean; isPrimary: boolean }[];
  memories: MemoryDto[];
  dates: { id: string; kind: "birthday" | "anniversary" | "other"; label: string | null; month: number; day: number; year: number | null }[];
};

export const REQUIRED_SAMPLES = 3;
