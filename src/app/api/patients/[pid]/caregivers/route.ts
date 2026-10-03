import { addCaregiverBody } from "@/lib/contracts/patients";
import { requireCaregiverFor } from "@/server/auth/guards";
import { json, route } from "@/server/http/route";
import { addCoCaregiver, careTeam } from "@/server/services/patients";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  return { caregivers: await careTeam(params.pid) };
});

export const POST = route({ body: addCaregiverBody }, async ({ req, params, body }) => {
  await requireCaregiverFor(req, params.pid, { owner: true });
  return json(await addCoCaregiver(params.pid, body.email), 201);
});
