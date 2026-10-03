import { requireCaregiverFor } from "@/server/auth/guards";
import { noContent, route } from "@/server/http/route";
import { deleteFence } from "@/server/services/geofence";

export const runtime = "nodejs";

export const DELETE = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  await deleteFence(params.pid, params.fid);
  return noContent();
});
