import { requireCaregiver } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { patientsForCaregiver } from "@/server/services/caregivers";

export const runtime = "nodejs";

export const GET = route({}, async ({ req }) => {
  const caregiver = await requireCaregiver(req);
  const patients = await patientsForCaregiver(caregiver.id);
  return { caregiver, patients: patients.map(({ id, preferredName, name }) => ({ id, preferredName, name })) };
});
