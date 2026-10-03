import { scheduleBody } from "@/lib/contracts/schedule";
import { requireCaregiverFor } from "@/server/auth/guards";
import { json, route } from "@/server/http/route";
import { createScheduleItem, listSchedule } from "@/server/services/schedule";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  return { items: await listSchedule(params.pid) };
});

export const POST = route({ body: scheduleBody }, async ({ req, params, body }) => {
  await requireCaregiverFor(req, params.pid);
  return json({ item: await createScheduleItem(params.pid, body) }, 201);
});
