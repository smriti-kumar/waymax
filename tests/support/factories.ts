import { db } from "@/server/db/client";
import { caregivers, patientCaregivers, patients } from "@/server/db/schema";
import { createSession } from "@/server/auth/sessions";
import { hashPassword } from "@/server/auth/passwords";

let n = 0;

export async function makeCaregiver(name = "Casey") {
  n++;
  const [cg] = await db()
    .insert(caregivers)
    .values({ email: `cg${n}-${Date.now()}@example.com`, passwordHash: await hashPassword("password123"), name })
    .returning();
  const { token } = await createSession(cg.id);
  return { caregiver: cg, token, cookie: `wm_session=${token}` };
}

export async function makePatient(caregiverId?: string, values: Partial<typeof patients.$inferInsert> = {}) {
  const [p] = await db()
    .insert(patients)
    .values({ name: "Margaret Lee", preferredName: "Maggie", ...values })
    .returning();
  if (caregiverId) await db().insert(patientCaregivers).values({ patientId: p.id, caregiverId, role: "owner" });
  return p;
}

import { createPairingCode, pairDevice } from "@/server/services/devices";

export async function makeDevice(patientId: string, caregiverId: string, kind: "patient_display" | "patient_phone" = "patient_display") {
  const { code } = await createPairingCode(patientId, caregiverId, kind);
  const paired = await pairDevice(code, kind === "patient_display" ? "Laptop" : "Phone");
  return { ...paired, cookie: `wm_device=${paired.token}`, auth: { authorization: `Device ${paired.token}` } };
}
