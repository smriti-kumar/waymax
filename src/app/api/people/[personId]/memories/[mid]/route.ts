import { patchMemoryBody } from "@/lib/contracts/people";
import { noContent, route } from "@/server/http/route";
import { deleteMemory, personForCaregiver, updateMemory } from "@/server/services/people";

export const runtime = "nodejs";

export const PATCH = route({ body: patchMemoryBody }, async ({ req, params, body }) => {
  const { person } = await personForCaregiver(req, params.personId);
  return { memory: await updateMemory(person, params.mid, body) };
});

export const DELETE = route({}, async ({ req, params }) => {
  const { person } = await personForCaregiver(req, params.personId);
  await deleteMemory(person.id, params.mid);
  return noContent();
});
