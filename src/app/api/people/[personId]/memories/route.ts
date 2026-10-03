import { memoryBody } from "@/lib/contracts/people";
import { json, route } from "@/server/http/route";
import { createMemory, listMemories, personForCaregiver } from "@/server/services/people";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  const { person } = await personForCaregiver(req, params.personId);
  return { memories: await listMemories(person.id) };
});

export const POST = route({ body: memoryBody }, async ({ req, params, body }) => {
  const { person } = await personForCaregiver(req, params.personId);
  return json({ memory: await createMemory(person, body) }, 201);
});
