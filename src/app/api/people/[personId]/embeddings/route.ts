import { embeddingsBody } from "@/lib/contracts/people";
import { json, route } from "@/server/http/route";
import { addEmbeddings } from "@/server/services/faces";
import { personForCaregiver } from "@/server/services/people";

export const runtime = "nodejs";

export const POST = route({ body: embeddingsBody }, async ({ req, params, body }) => {
  const { person } = await personForCaregiver(req, params.personId);
  const count = await addEmbeddings(person, body.items);
  return json({ count }, 201);
});
