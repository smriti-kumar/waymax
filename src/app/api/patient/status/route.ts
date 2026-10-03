import { eq } from "drizzle-orm";
import { deviceStatusBody } from "@/lib/contracts/patient";
import { requireDevice } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { devices, patients } from "@/server/db/schema";
import { isValidTimezone } from "@/lib/contracts/common";
import { noContent, route } from "@/server/http/route";

export const runtime = "nodejs";

/** Patient devices report camera / mic / model / GPS health so the caregiver sees problems. */
export const POST = route({ body: deviceStatusBody }, async ({ req, body }) => {
  const device = await requireDevice(req);
  const { timezone, ...rest } = body;
  // The patient's laptop is where the patient is: its clock's timezone wins, so
  // the Today card and calming mode say the local time.
  if (timezone && device.kind === "patient_display" && isValidTimezone(timezone)) {
    await db().update(patients).set({ timezone }).where(eq(patients.id, device.patientId));
  }
  const status = { ...((device.capabilities as { status?: object }).status ?? {}), ...rest, at: new Date().toISOString() };
  await db()
    .update(devices)
    .set({ capabilities: { ...device.capabilities, status } })
    .where(eq(devices.id, device.id));
  return noContent();
});
