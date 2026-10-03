import { unknownPersonBody } from "@/lib/contracts/approvals";
import { requireDevice } from "@/server/auth/guards";
import { json, route } from "@/server/http/route";
import { addUnknownPerson } from "@/server/services/approvals";

export const runtime = "nodejs";

export const POST = route({ body: unknownPersonBody }, async ({ req, body }) => {
  const device = await requireDevice(req, ["patient_display", "webcam"]);
  return json(await addUnknownPerson(device.patientId, body), 201);
});
