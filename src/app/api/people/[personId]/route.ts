import { patchPersonBody } from "@/lib/contracts/people";
import { noContent, route } from "@/server/http/route";
import { deletePerson, personDetail, personForCaregiver, updatePerson } from "@/server/services/people";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  const { person } = await personForCaregiver(req, params.personId);
  return personDetail(person.id);
});

export const PATCH = route({ body: patchPersonBody }, async ({ req, params, body }) => {
  const { person, caregiver } = await personForCaregiver(req, params.personId);
  return { person: await updatePerson(person, caregiver.id, body) };
});

export const DELETE = route({}, async ({ req, params }) => {
  const { person } = await personForCaregiver(req, params.personId);
  await deletePerson(person.id);
  return noContent();
});
