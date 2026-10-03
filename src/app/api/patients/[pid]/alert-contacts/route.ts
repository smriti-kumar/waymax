import { alertContactBody } from "@/lib/contracts/alerts";
import { requireCaregiverFor } from "@/server/auth/guards";
import { json, route } from "@/server/http/route";
import { addContact, listContacts } from "@/server/services/alertContacts";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  return { contacts: await listContacts(params.pid) };
});

export const POST = route({ body: alertContactBody }, async ({ req, params, body }) => {
  await requireCaregiverFor(req, params.pid);
  return json({ contact: await addContact(params.pid, body) }, 201);
});
