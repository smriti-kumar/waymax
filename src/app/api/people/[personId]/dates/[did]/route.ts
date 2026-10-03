import { noContent, route } from "@/server/http/route";
import { deleteDate } from "@/server/services/dates";
import { personForCaregiver } from "@/server/services/people";

export const runtime = "nodejs";

export const DELETE = route({}, async ({ req, params }) => {
  const { person } = await personForCaregiver(req, params.personId);
  await deleteDate(person.id, params.did);
  return noContent();
});
