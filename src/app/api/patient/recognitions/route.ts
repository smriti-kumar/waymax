import { recognitionBody } from "@/lib/contracts/patient";
import { requireDevice } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { recordRecognition } from "@/server/services/recognition";

export const runtime = "nodejs";

export const POST = route({ body: recognitionBody }, async ({ req, body }) => {
  const device = await requireDevice(req, ["patient_display", "webcam"]);
  return recordRecognition(device.patientId, device.id, body);
});
