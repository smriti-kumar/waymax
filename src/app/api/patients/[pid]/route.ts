import { patchPatientBody } from "@/lib/contracts/patients";
import { requireCaregiverFor } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { getPatientDetail, updatePatient } from "@/server/services/patients";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  return getPatientDetail(params.pid);
});

export const PATCH = route({ body: patchPatientBody }, async ({ req, params, body }) => {
  await requireCaregiverFor(req, params.pid);
  return { patient: await updatePatient(params.pid, body) };
});
