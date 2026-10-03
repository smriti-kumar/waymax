import { requireCaregiverFor } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { listDevices } from "@/server/services/devices";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  return { devices: await listDevices(params.pid) };
});
