import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { devices, patients } from "@/server/db/schema";
import { DEVICE_COOKIE } from "./cookies";
import { hashToken } from "./tokens";

export async function currentDevice() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db()
    .select({
      device: { id: devices.id, kind: devices.kind, label: devices.label },
      patient: { id: patients.id, preferredName: patients.preferredName, timezone: patients.timezone },
    })
    .from(devices)
    .innerJoin(patients, eq(patients.id, devices.patientId))
    .where(and(eq(devices.tokenHash, hashToken(token)), isNull(devices.revokedAt)));
  return row ?? null;
}

/** For patient pages: the paired device of the right kind, or a redirect to /pair. */
export async function deviceOrRedirect(kind: "patient_display" | "patient_phone") {
  const d = await currentDevice();
  if (!d) redirect("/pair");
  if (d.device.kind !== kind) redirect(d.device.kind === "patient_phone" ? "/phone" : "/patient");
  return d;
}
