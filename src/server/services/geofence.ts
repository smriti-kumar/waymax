import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/server/db/client";
import { geofences, locationPings, patients } from "@/server/db/schema";
import { conflict, notFound, unprocessable } from "@/server/http/errors";
import { isUuid } from "@/server/auth/guards";
import { evaluatePing, type Evaluation } from "@/lib/geofence";
import { formatDistance, offsetPoint, osmLink, pickActiveFence } from "@/lib/geo";
import { sendGeofenceAlert } from "./notify";

type Source = "browser" | "shortcut" | "simulated" | "device";

export async function setHomeFence(pid: string, input: { lat: number; lng: number; radiusM: number; label: string }) {
  return db().transaction(async (tx) => {
    const [existing] = await tx.select().from(geofences).where(and(eq(geofences.patientId, pid), eq(geofences.kind, "home")));
    let fence;
    if (existing) {
      [fence] = await tx
        .update(geofences)
        .set({ centerLat: input.lat, centerLng: input.lng, radiusM: input.radiusM, label: input.label, isActive: true })
        .where(eq(geofences.id, existing.id))
        .returning();
    } else {
      [fence] = await tx
        .insert(geofences)
        .values({ patientId: pid, kind: "home", label: input.label, centerLat: input.lat, centerLng: input.lng, radiusM: input.radiusM })
        .returning();
    }
    await tx.update(patients).set({ homeLat: input.lat, homeLng: input.lng, homeLabel: input.label }).where(eq(patients.id, pid));
    return fence;
  });
}

export async function addTemporaryFence(
  pid: string,
  input: { label: string; lat: number; lng: number; radiusM: number; activeFrom: string; activeUntil: string },
) {
  const from = new Date(input.activeFrom);
  const until = new Date(input.activeUntil);
  if (!(until > from)) throw unprocessable("The end time must be after the start time");
  if (until.getTime() < Date.now()) throw unprocessable("That window has already ended");
  const [fence] = await db()
    .insert(geofences)
    .values({ patientId: pid, kind: "temporary", label: input.label, centerLat: input.lat, centerLng: input.lng, radiusM: input.radiusM, activeFrom: from, activeUntil: until })
    .returning();
  return fence;
}

export async function deleteFence(pid: string, fid: string) {
  if (!isUuid(fid)) throw notFound("Fence not found");
  const [f] = await db().select().from(geofences).where(and(eq(geofences.id, fid), eq(geofences.patientId, pid)));
  if (!f) throw notFound("Fence not found");
  if (f.kind === "home") throw conflict("The home area can't be deleted, only moved");
  await db().delete(geofences).where(eq(geofences.id, fid));
}

export async function listFences(pid: string) {
  return db().select().from(geofences).where(eq(geofences.patientId, pid)).orderBy(desc(geofences.createdAt));
}

/** Store a ping, run the state machine, and alert on a change. */
export async function recordPing(
  pid: string,
  deviceId: string | null,
  ping: { lat: number; lng: number; accuracyM?: number | null; recordedAt?: Date; source: Source },
  now = new Date(),
) {
  const recordedAt = ping.recordedAt ?? now;
  const result = await db().transaction(async (tx) => {
    await tx.insert(locationPings).values({
      patientId: pid,
      deviceId,
      lat: ping.lat,
      lng: ping.lng,
      accuracyM: ping.accuracyM ?? null,
      source: ping.source,
      recordedAt,
      receivedAt: now,
    });
    const [p] = await tx.select().from(patients).where(eq(patients.id, pid)).for("update");
    if (!p) throw notFound("Patient not found");
    const fences = await tx.select().from(geofences).where(eq(geofences.patientId, pid));
    const ev: Evaluation = evaluatePing({ state: p.geofenceState, streak: p.outsideStreak }, fences, ping, recordedAt);
    const changedAt = ev.transition ? now : p.geofenceStateChangedAt;
    await tx
      .update(patients)
      .set({
        geofenceState: ev.state,
        outsideStreak: ev.streak,
        geofenceStateChangedAt: ev.state !== p.geofenceState ? now : p.geofenceStateChangedAt,
        lastLocationAt: p.lastLocationAt && p.lastLocationAt > recordedAt ? p.lastLocationAt : recordedAt,
      })
      .where(eq(patients.id, pid));
    return { ev, patient: p, fence: pickActiveFence(fences, recordedAt), changedAt };
  });

  const { ev, patient, fence, changedAt } = result;
  if (ev.transition && fence && changedAt) {
    const time = formatInTimeZone(recordedAt, patient.timezone, "h:mm a");
    const name = patient.preferredName;
    const exit = ev.transition === "exit";
    const body = exit
      ? `Waymax: ${name} has left ${fence.label}. Last seen ${time}, ${formatDistance(ev.distanceM ?? 0)} away: ${osmLink(ping)}`
      : `Waymax: ${name} is back at ${fence.label} (${time}).`;
    await sendGeofenceAlert({
      patientId: pid,
      kind: exit ? "geofence_exit" : "geofence_return",
      title: exit ? `${name} has left ${fence.label}` : `${name} is back at ${fence.label}`,
      body,
      dedupeKey: `${exit ? "geofence_exit" : "geofence_return"}:${pid}:${changedAt.toISOString()}`,
    });
  }
  return { state: ev.state, transition: ev.transition, ignored: ev.ignored ?? null, distanceM: ev.distanceM };
}

/** Demo control: 3 simulated pings along a line from the fence center. */
export async function simulateWalk(pid: string, action: "walk_out" | "walk_home") {
  const fences = await listFences(pid);
  const fence = pickActiveFence(fences);
  if (!fence) throw unprocessable("Set the home area on the map first");
  const factors = action === "walk_out" ? [0.5, 1.5, 1.8] : [1.8, 1.5, 0.5];
  const center = { lat: fence.centerLat, lng: fence.centerLng };
  let last: Awaited<ReturnType<typeof recordPing>> | null = null;
  const base = Date.now();
  for (let i = 0; i < factors.length; i++) {
    const pt = offsetPoint(center, fence.radiusM * factors[i]!, 60);
    last = await recordPing(pid, null, { ...pt, accuracyM: 10, source: "simulated", recordedAt: new Date(base + i) }, new Date(base + i));
  }
  return last!;
}

export async function locationTrail(pid: string, limit: number) {
  const [p] = await db().select().from(patients).where(eq(patients.id, pid));
  if (!p) throw notFound("Patient not found");
  const rows = await db()
    .select({ lat: locationPings.lat, lng: locationPings.lng, accuracyM: locationPings.accuracyM, recordedAt: locationPings.recordedAt, source: locationPings.source })
    .from(locationPings)
    .where(eq(locationPings.patientId, pid))
    .orderBy(desc(locationPings.recordedAt))
    .limit(limit);
  const trail = rows.map((r) => ({ ...r, recordedAt: r.recordedAt.toISOString() }));
  const fence = pickActiveFence(await listFences(pid));
  return {
    latest: trail[0] ?? null,
    trail,
    fence: fence
      ? { id: fence.id, kind: fence.kind, label: fence.label, centerLat: fence.centerLat, centerLng: fence.centerLng, radiusM: fence.radiusM }
      : null,
    state: p.geofenceState,
    stateChangedAt: p.geofenceStateChangedAt?.toISOString() ?? null,
  };
}
