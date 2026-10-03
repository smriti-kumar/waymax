import { requireDevice } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { deviceProfile } from "@/server/services/devices";

export const runtime = "nodejs";

export const GET = route({}, async ({ req }) => {
  const device = await requireDevice(req);
  return deviceProfile(device.id);
});
