import { startConversationBody } from "@/lib/contracts/conversations";
import { requireDeviceOrCaregiver, requirePatientAccess } from "@/server/auth/guards";
import { badRequest } from "@/server/http/errors";
import { json, route } from "@/server/http/route";
import { startConversation } from "@/server/services/conversations";
import { logEvent } from "@/server/services/events";

export const runtime = "nodejs";

export const POST = route({ body: startConversationBody }, async ({ req, body }) => {
  const who = await requireDeviceOrCaregiver(req);
  let patientId: string;
  if (who.device) patientId = who.device.patientId;
  else {
    if (!body.patientId) throw badRequest("patientId is required");
    await requirePatientAccess(who.caregiver!.id, body.patientId);
    patientId = body.patientId;
  }
  const r = await startConversation(patientId, body);
  if (!r.existing && who.device) await logEvent(patientId, who.device.id, "listen_started", { conversationId: r.conversationId });
  return json({ conversationId: r.conversationId }, r.existing ? 200 : 201);
});
