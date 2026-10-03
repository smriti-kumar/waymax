import { requireCaregiverFor } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { buildDashboard } from "@/server/services/dashboard";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  return buildDashboard(params.pid);
});
