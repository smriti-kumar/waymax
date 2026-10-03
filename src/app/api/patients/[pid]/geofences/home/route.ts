import { homeFenceBody } from "@/lib/contracts/location";
import { requireCaregiverFor } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { setHomeFence } from "@/server/services/geofence";

export const runtime = "nodejs";

export const PUT = route({ body: homeFenceBody }, async ({ req, params, body }) => {
  await requireCaregiverFor(req, params.pid);
  return { fence: await setHomeFence(params.pid, body) };
});
