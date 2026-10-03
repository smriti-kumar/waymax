import { requireDevice } from "@/server/auth/guards";
import { notFound } from "@/server/http/errors";
import { route } from "@/server/http/route";
import { finishConversation, getConversation } from "@/server/services/conversations";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = route({}, async ({ req, params }) => {
  const device = await requireDevice(req, ["patient_display"]);
  const convo = await getConversation(params.cid);
  if (convo.patientId !== device.patientId) throw notFound("Conversation not found");
  return finishConversation(convo);
});
