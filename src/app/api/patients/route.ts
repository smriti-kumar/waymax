import { createPatientBody } from "@/lib/contracts/patients";
import { requireCaregiver } from "@/server/auth/guards";
import { json, route } from "@/server/http/route";
import { createPatient } from "@/server/services/patients";
import { patientsForCaregiver } from "@/server/services/caregivers";

export const runtime = "nodejs";

export const GET = route({}, async ({ req }) => {
  const cg = await requireCaregiver(req);
  return { patients: await patientsForCaregiver(cg.id) };
});

export const POST = route({ body: createPatientBody }, async ({ req, body }) => {
  const cg = await requireCaregiver(req);
  const patient = await createPatient(cg.id, body);
  return json({ patient }, 201);
});
