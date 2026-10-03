import { requireDevice } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { buildCalming } from "@/server/services/calming";

export const runtime = "nodejs";

export const GET = route({}, async ({ req }) => {
  const device = await requireDevice(req, ["patient_display"]);
  return buildCalming(device.patientId);
});
