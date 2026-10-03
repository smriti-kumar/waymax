import { requireCaregiverFor } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { setupStatus } from "@/server/services/setup";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  return { steps: await setupStatus(params.pid) };
});
