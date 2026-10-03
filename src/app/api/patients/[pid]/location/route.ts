import { trailQuery } from "@/lib/contracts/location";
import { requireCaregiverFor } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { locationTrail } from "@/server/services/geofence";

export const runtime = "nodejs";

export const GET = route({ query: trailQuery }, async ({ req, params, query }) => {
  await requireCaregiverFor(req, params.pid);
  return locationTrail(params.pid, query.limit);
});
