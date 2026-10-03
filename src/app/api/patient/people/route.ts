import { requireDevice } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { approvedPeople } from "@/server/services/faces";

export const runtime = "nodejs";

export const GET = route({}, async ({ req }) => {
  const device = await requireDevice(req, ["patient_display"]);
  return { people: await approvedPeople(device.patientId) };
});
