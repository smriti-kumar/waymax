import { eventBody } from "@/lib/contracts/patient";
import { requireDevice } from "@/server/auth/guards";
import { noContent, route } from "@/server/http/route";
import { logEvent } from "@/server/services/events";

export const runtime = "nodejs";

export const POST = route({ body: eventBody }, async ({ req, body }) => {
  const device = await requireDevice(req, ["patient_display"]);
  await logEvent(device.patientId, device.id, body.kind, body.payload);
  return noContent();
});
