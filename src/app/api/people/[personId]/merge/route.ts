import { mergeBody } from "@/lib/contracts/approvals";
import { route } from "@/server/http/route";
import { mergeInto } from "@/server/services/approvals";
import { personForCaregiver } from "@/server/services/people";

export const runtime = "nodejs";

/** Approval queue "Merge": fold this (pending) capture into an existing person. */
export const POST = route({ body: mergeBody }, async ({ req, params, body }) => {
  const { person } = await personForCaregiver(req, params.personId);
  return { person: await mergeInto(person, body.intoPersonId) };
});
