import { requireDevice } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { buildToday } from "@/server/services/schedule";

export const runtime = "nodejs";

export const GET = route({}, async ({ req }) => {
  const device = await requireDevice(req, ["patient_display"]);
  return buildToday(device.patientId);
});
