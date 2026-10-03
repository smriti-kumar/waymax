import { createPersonBody, peopleQuery } from "@/lib/contracts/people";
import { requireCaregiverFor } from "@/server/auth/guards";
import { json, route } from "@/server/http/route";
import { createPerson, listPeople } from "@/server/services/people";

export const runtime = "nodejs";

export const GET = route({ query: peopleQuery }, async ({ req, params, query }) => {
  await requireCaregiverFor(req, params.pid);
  return { people: await listPeople(params.pid, query.status) };
});

export const POST = route({ body: createPersonBody }, async ({ req, params, body }) => {
  const { caregiver } = await requireCaregiverFor(req, params.pid);
  return json({ person: await createPerson(params.pid, caregiver.id, body) }, 201);
});
