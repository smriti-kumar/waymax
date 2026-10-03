import { dateBody } from "@/lib/contracts/dates";
import { json, route } from "@/server/http/route";
import { addDate, listDates } from "@/server/services/dates";
import { personForCaregiver } from "@/server/services/people";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  const { person } = await personForCaregiver(req, params.personId);
  return { dates: await listDates(person.id) };
});

export const POST = route({ body: dateBody }, async ({ req, params, body }) => {
  const { person } = await personForCaregiver(req, params.personId);
  return json({ date: await addDate(person.id, body) }, 201);
});
