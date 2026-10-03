import "server-only";
import { and, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "@/server/db/client";
import { devices, pairingCodes, patients } from "@/server/db/schema";
import { badRequest, notFound } from "@/server/http/errors";
import { hashToken, newToken, sixDigitCode } from "@/server/auth/tokens";

export const PAIRING_TTL_MS = 10 * 60 * 1000;
type PairableKind = "patient_display" | "patient_phone";

const CAPABILITIES: Record<PairableKind, Record<string, boolean>> = {
  patient_display: { camera: true, microphone: true, speaker: true, gps: false },
  patient_phone: { camera: false, microphone: false, speaker: false, gps: true },
};

export async function createPairingCode(pid: string, caregiverId: string, deviceKind: PairableKind, now = new Date()) {
  await db().delete(pairingCodes).where(lt(pairingCodes.expiresAt, new Date(now.getTime() - 86400_000)));
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = sixDigitCode();
    const rows = await db()
      .insert(pairingCodes)
      .values({ code, patientId: pid, deviceKind, createdBy: caregiverId, expiresAt })
      .onConflictDoNothing()
      .returning();
    if (rows.length) return { code, expiresAt };
  }
  throw new Error("Could not allocate a pairing code");
}

const BAD_CODE = "That code didn't work. Ask your caregiver for a new one.";

/** Consumes a code exactly once and creates the device. */
export async function pairDevice(code: string, label: string, now = new Date()) {
  return db().transaction(async (tx) => {
    const [pc] = await tx
      .update(pairingCodes)
      .set({ usedAt: now })
      .where(and(eq(pairingCodes.code, code), isNull(pairingCodes.usedAt), gt(pairingCodes.expiresAt, now)))
      .returning();
    if (!pc) throw badRequest(BAD_CODE);
    const token = newToken();
    const kind = pc.deviceKind as PairableKind;
    const [device] = await tx
      .insert(devices)
      .values({
        patientId: pc.patientId,
        kind,
        label,
        tokenHash: hashToken(token),
        capabilities: CAPABILITIES[kind] ?? {},
        lastSeenAt: now,
      })
      .returning();
    return { deviceId: device.id, patientId: pc.patientId, kind: device.kind, token };
  });
}

export async function deviceProfile(deviceId: string) {
  const [row] = await db()
    .select({
      device: { id: devices.id, kind: devices.kind, label: devices.label, capabilities: devices.capabilities },
      patient: { id: patients.id, preferredName: patients.preferredName, timezone: patients.timezone },
    })
    .from(devices)
    .innerJoin(patients, eq(patients.id, devices.patientId))
    .where(eq(devices.id, deviceId));
  if (!row) throw notFound();
  return row;
}

export async function listDevices(pid: string) {
  return db()
    .select({
      id: devices.id,
      kind: devices.kind,
      label: devices.label,
      lastSeenAt: devices.lastSeenAt,
      revokedAt: devices.revokedAt,
      createdAt: devices.createdAt,
    })
    .from(devices)
    .where(eq(devices.patientId, pid))
    .orderBy(desc(devices.createdAt));
}

export async function revokeDevice(pid: string, did: string) {
  const rows = await db()
    .update(devices)
    .set({ revokedAt: new Date() })
    .where(and(eq(devices.id, did), eq(devices.patientId, pid), isNull(devices.revokedAt)))
    .returning({ id: devices.id });
  if (!rows.length) throw notFound("Device not found");
}
