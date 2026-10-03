import { z } from "zod";
import { uuid } from "./common";

export const startConversationBody = z.object({
  visitId: uuid.nullish(),
  personId: uuid.nullish(),
  /** Caregivers only: which patient (devices use their own). */
  patientId: uuid.optional(),
});
export const chunkQuery = z.object({ seq: z.coerce.number().int().min(0).max(1000) });
export const conversationsQuery = z.object({ personId: uuid.optional() });

export type SpeakerClaimDto = { claimedName: string; matchesFace: boolean | null; matchedPersonId?: string | null; faceName?: string | null };
export type FinishResponse = {
  status: "done" | "failed";
  summary: string | null;
  keyFacts: string[];
  speakerClaim: SpeakerClaimDto | null;
  mightBe: { personId: string; name: string } | null;
};
