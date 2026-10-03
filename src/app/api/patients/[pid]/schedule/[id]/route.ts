import { patchScheduleBody } from "@/lib/contracts/schedule";
import { requireCaregiverFor } from "@/server/auth/guards";
import { noContent, route } from "@/server/http/route";
import { deleteScheduleItem, updateScheduleItem } from "@/server/services/schedule";

export const runtime = "nodejs";

export const PATCH = route({ body: patchScheduleBody }, async ({ req, params, body }) => {
  await requireCaregiverFor(req, params.pid);
  return { item: await updateScheduleItem(params.pid, params.id, body) };
});

export const DELETE = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  await deleteScheduleItem(params.pid, params.id);
  return noContent();
});
