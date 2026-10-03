import { requireDevice } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { listQuestions } from "@/server/services/questions";

export const runtime = "nodejs";

export const GET = route({}, async ({ req }) => {
  const device = await requireDevice(req, ["patient_display"]);
  const qs = await listQuestions(device.patientId, true);
  return { questions: qs.map(({ id, question, answer }) => ({ id, question, answer })) };
});
