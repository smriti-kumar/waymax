import { requireCaregiverFor } from "@/server/auth/guards";
import { noContent, route } from "@/server/http/route";
import { markRead, notificationPatient } from "@/server/services/notifications";

export const runtime = "nodejs";

export const POST = route({}, async ({ req, params }) => {
  const pid = await notificationPatient(params.nid);
  await requireCaregiverFor(req, pid);
  await markRead(params.nid);
  return noContent();
});
