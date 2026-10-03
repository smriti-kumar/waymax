import { eq } from "drizzle-orm";
import { requireCaregiverFor } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { people } from "@/server/db/schema";
import { route } from "@/server/http/route";
import { getConversation } from "@/server/services/conversations";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  const c = await getConversation(params.cid);
  await requireCaregiverFor(req, c.patientId);
  const [p] = c.personId ? await db().select({ name: people.name }).from(people).where(eq(people.id, c.personId)) : [];
  return {
    conversation: {
      id: c.id,
      status: c.status,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      summary: c.summary,
      keyFacts: c.keyFacts,
      speakerClaim: c.speakerClaim,
      personId: c.personId,
      personName: p?.name ?? null,
    },
    transcript: c.transcript,
  };
});
