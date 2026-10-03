import "server-only";
import { timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { devices, patientCaregivers, patients } from "@/server/db/schema";
import { env } from "@/server/env";
import { forbidden, notFound, unauthorized } from "@/server/http/errors";
import { DEVICE_COOKIE, SESSION_COOKIE } from "./cookies";
import { caregiverForToken, type Caregiver } from "./sessions";
import { hashToken } from "./tokens";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string | undefined | null): s is string => !!s && UUID_RE.test(s);

export async function requireCaregiver(req: NextRequest): Promise<Caregiver> {
  const cg = await caregiverForToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!cg) throw unauthorized();
  return cg;
}

export async function optionalCaregiver(req: NextRequest): Promise<Caregiver | null> {
  return caregiverForToken(req.cookies.get(SESSION_COOKIE)?.value);
}

/** Throws 404 when the patient doesn't exist, 403 when the caregiver isn't linked to it. */
export async function requirePatientAccess(caregiverId: string, patientId: string, opts: { owner?: boolean } = {}) {
  if (!isUuid(patientId)) throw notFound("Patient not found");
  const rows = await db()
    .select({ id: patients.id, role: patientCaregivers.role })
    .from(patients)
    .leftJoin(
      patientCaregivers,
      and(eq(patientCaregivers.patientId, patients.id), eq(patientCaregivers.caregiverId, caregiverId)),
    )
    .where(eq(patients.id, patientId))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound("Patient not found");
  if (!row.role) throw forbidden();
  if (opts.owner && row.role !== "owner") throw forbidden("Only the patient's owner can do that");
  return { role: row.role };
}

/** Caregiver session + access to `pid` in one call. */
export async function requireCaregiverFor(req: NextRequest, patientId: string, opts: { owner?: boolean } = {}) {
  const caregiver = await requireCaregiver(req);
  const access = await requirePatientAccess(caregiver.id, patientId, opts);
  return { caregiver, role: access.role };
}

export type DeviceRow = typeof devices.$inferSelect;
export type DeviceKind = DeviceRow["kind"];

function deviceTokenFrom(req: NextRequest): string | undefined {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Device ")) return header.slice(7).trim();
  return req.cookies.get(DEVICE_COOKIE)?.value;
}

export async function deviceForRequest(req: NextRequest): Promise<DeviceRow | null> {
  const token = deviceTokenFrom(req);
  if (!token) return null;
  const rows = await db()
    .update(devices)
    .set({ lastSeenAt: new Date() })
    .where(and(eq(devices.tokenHash, hashToken(token)), isNull(devices.revokedAt)))
    .returning();
  return rows[0] ?? null;
}

export async function requireDevice(req: NextRequest, kinds?: DeviceKind[]): Promise<DeviceRow> {
  const device = await deviceForRequest(req);
  if (!device) throw unauthorized("This device isn't paired");
  if (kinds && !kinds.includes(device.kind)) throw forbidden("This device can't do that");
  return device;
}

/** Device of the patient, or a caregiver linked to it. Returns who is acting. */
export async function requireDeviceOrCaregiver(req: NextRequest) {
  const device = await deviceForRequest(req);
  if (device) return { device, caregiver: null as Caregiver | null };
  const caregiver = await caregiverForToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (caregiver) return { device: null as DeviceRow | null, caregiver };
  throw unauthorized();
}

export function requireWorker(req: NextRequest) {
  const secret = env().WORKER_SECRET;
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || !given) throw unauthorized();
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw unauthorized();
}
