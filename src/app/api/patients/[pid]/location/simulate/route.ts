import { simulateBody } from "@/lib/contracts/location";
import { requireCaregiverFor } from "@/server/auth/guards";
import { env } from "@/server/env";
import { notFound } from "@/server/http/errors";
import { route } from "@/server/http/route";
import { simulateWalk } from "@/server/services/geofence";

export const runtime = "nodejs";

/** Demo control (NEXT_PUBLIC_DEMO_MODE=true only). */
export const POST = route({ body: simulateBody }, async ({ req, params, body }) => {
  if (!env().NEXT_PUBLIC_DEMO_MODE) throw notFound();
  await requireCaregiverFor(req, params.pid);
  return simulateWalk(params.pid, body.action);
});
