import { tempFenceBody } from "@/lib/contracts/location";
import { requireCaregiverFor } from "@/server/auth/guards";
import { json, route } from "@/server/http/route";
import { addTemporaryFence, listFences } from "@/server/services/geofence";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  return { fences: await listFences(params.pid) };
});

export const POST = route({ body: tempFenceBody }, async ({ req, params, body }) => {
  await requireCaregiverFor(req, params.pid);
  return json({ fence: await addTemporaryFence(params.pid, body) }, 201);
});
