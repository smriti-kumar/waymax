import "server-only";
import type { SpeakerClaim } from "@/server/db/schema";
import { namesMatch } from "@/lib/text";

export type Candidate = { id: string; name: string | null; spokenName: string | null };

/**
 * Second identity layer (§5.4). Today: compare names people say ("it's Priya")
 * with the face match. A voiceprint model can replace this behind the same interface.
 */
export interface SpeakerIdentifier {
  identify(input: { claimedNames: string[]; facePerson: Candidate | null; approved: Candidate[] }): SpeakerClaim | null;
}

export class NameClaimSpeakerIdentifier implements SpeakerIdentifier {
  identify({ claimedNames, facePerson, approved }: { claimedNames: string[]; facePerson: Candidate | null; approved: Candidate[] }): SpeakerClaim | null {
    const claims = [...new Set(claimedNames.map((n) => n.trim()).filter(Boolean))];
    if (!claims.length) return null;
    if (facePerson) {
      const hit = claims.find((c) => namesMatch(c, [facePerson.name, facePerson.spokenName]));
      if (hit) return { claimedName: hit, matchesFace: true, matchedPersonId: facePerson.id, faceName: facePerson.name };
      const other = claims[0]!;
      const matched = approved.find((p) => p.id !== facePerson.id && namesMatch(other, [p.name, p.spokenName]));
      return { claimedName: other, matchesFace: false, matchedPersonId: matched?.id ?? null, faceName: facePerson.name };
    }
    for (const c of claims) {
      const matched = approved.find((p) => namesMatch(c, [p.name, p.spokenName]));
      if (matched) return { claimedName: c, matchesFace: null, matchedPersonId: matched.id, faceName: null };
    }
    return { claimedName: claims[0]!, matchesFace: null, matchedPersonId: null, faceName: null };
  }
}
