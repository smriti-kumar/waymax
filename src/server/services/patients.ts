import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { caregivers, geofences, locationPings, patientCaregivers, patients } from "@/server/db/schema";
import { conflict, notFound } from "@/server/http/errors";
import { pickActiveFence } from "@/lib/geo";

export type PatientRow = typeof patients.$inferSelect;

export async function createPatient(
  caregiverId: string,
  input: { name: string; preferredName: string; timezone: string },
) {
  return db().transaction(async (tx) => {
    const [p] = await tx.insert(patients).values(input).returning();
    await tx.insert(patientCaregivers).values({ patientId: p.id, caregiverId, role: "owner" });
    return p;
  });
}

export async function getPatient(pid: string): Promise<PatientRow> {
  const [p] = await db().select().from(patients).where(eq(patients.id, pid));
  if (!p) throw notFound("Patient not found");
  return p;
}

export async function patientFences(pid: string) {
  return db().select().from(geofences).where(eq(geofences.patientId, pid)).orderBy(desc(geofences.createdAt));
}

export async function lastLocation(pid: string) {
  const [l] = await db()
    .select({
      lat: locationPings.lat,
      lng: locationPings.lng,
      accuracyM: locationPings.accuracyM,
      source: locationPings.source,
      recordedAt: locationPings.recordedAt,
    })
    .from(locationPings)
    .where(eq(locationPings.patientId, pid))
    .orderBy(desc(locationPings.recordedAt))
    .limit(1);
  return l ?? null;
}

export async function getPatientDetail(pid: string) {
  const [patient, fences, last] = await Promise.all([getPatient(pid), patientFences(pid), lastLocation(pid)]);
  return {
    patient,
    homeFence: fences.find((f) => f.kind === "home") ?? null,
    activeFence: pickActiveFence(fences),
    lastLocation: last,
  };
}

export async function updatePatient(
  pid: string,
  patch: Partial<{ name: string; preferredName: string; timezone: string; homeLabel: string; faceMatchThreshold: number | null }>,
) {
  const [p] = await db().update(patients).set(patch).where(eq(patients.id, pid)).returning();
  if (!p) throw notFound("Patient not found");
  if (patch.homeLabel) {
    await db()
      .update(geofences)
      .set({ label: patch.homeLabel })
      .where(and(eq(geofences.patientId, pid), eq(geofences.kind, "home")));
  }
  return p;
}

export async function addCoCaregiver(pid: string, email: string) {
  const [cg] = await db().select({ id: caregivers.id, name: caregivers.name }).from(caregivers).where(eq(caregivers.email, email));
  if (!cg) throw notFound("No Waymax account uses that email yet");
  const inserted = await db()
    .insert(patientCaregivers)
    .values({ patientId: pid, caregiverId: cg.id, role: "member" })
    .onConflictDoNothing()
    .returning();
  if (!inserted.length) throw conflict("That caregiver is already on the team");
  return { caregiverId: cg.id, name: cg.name, role: "member" as const };
}

export async function careTeam(pid: string) {
  return db()
    .select({ id: caregivers.id, name: caregivers.name, email: caregivers.email, role: patientCaregivers.role })
    .from(patientCaregivers)
    .innerJoin(caregivers, eq(caregivers.id, patientCaregivers.caregiverId))
    .where(eq(patientCaregivers.patientId, pid));
}
