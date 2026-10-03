import { requireCaregiverFor } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { listNotifications } from "@/server/services/notifications";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  return { notifications: await listNotifications(params.pid) };
});
