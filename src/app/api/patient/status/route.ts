import { eq } from "drizzle-orm";
import { deviceStatusBody } from "@/lib/contracts/patient";
import { requireDevice } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { devices } from "@/server/db/schema";
import { noContent, route } from "@/server/http/route";

export const runtime = "nodejs";

/** Patient devices report camera / mic / model / GPS health so the caregiver sees problems. */
export const POST = route({ body: deviceStatusBody }, async ({ req, body }) => {
  const device = await requireDevice(req);
  const status = { ...((device.capabilities as { status?: object }).status ?? {}), ...body, at: new Date().toISOString() };
  await db()
    .update(devices)
    .set({ capabilities: { ...device.capabilities, status } })
    .where(eq(devices.id, device.id));
  return noContent();
});
