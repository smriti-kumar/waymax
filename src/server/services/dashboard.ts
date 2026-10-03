import "server-only";
import { and, count, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db, sqlClient } from "@/server/db/client";
import { conversations, devices, notifications, people, visits } from "@/server/db/schema";
import { dayBounds, localDate } from "@/lib/schedule";
import { mediaUrl } from "@/server/storage";
import { friendlyDeliveryError } from "@/lib/delivery";
import { getPatient, lastLocation } from "./patients";
import { upcomingDates } from "./dates";

/** Continuous-aggregate bucket timezone (fixed for the demo, PLAN §4). */
export const AGG_TZ = "America/New_York";
export const STALE_PHONE_MS = 10 * 60_000;

export type DailyCount = { day: string; n: number };

function lastNDays(n: number, now = new Date()) {
  const out: string[] = [];
  const today = localDate(now, AGG_TZ);
  const [y, m, d] = today.split("-").map(Number);
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.UTC(y!, m! - 1, d! - i)).toISOString().slice(0, 10));
  return out;
}

/** Daily "I feel confused" presses from the Timescale continuous aggregate. */
async function dailyFromAggregate(pid: string, since: Date): Promise<DailyCount[]> {
  const rows = await sqlClient()`
    select to_char(day at time zone ${AGG_TZ}, 'YYYY-MM-DD') as day, sum(n)::int as n
    from patient_events_daily
    where patient_id = ${pid} and kind = 'confused_pressed' and day >= ${since.toISOString()}::timestamptz
    group by 1`;
  return rows.map((r) => ({ day: r.day as string, n: Number(r.n) }));
}

/** Same numbers from the raw table, for databases without the aggregate. */
async function dailyFromRaw(pid: string, since: Date): Promise<DailyCount[]> {
  const rows = await sqlClient()`
    select to_char(date_trunc('day', occurred_at at time zone ${AGG_TZ}), 'YYYY-MM-DD') as day, count(*)::int as n
    from patient_events
    where patient_id = ${pid} and kind = 'confused_pressed' and occurred_at >= ${since.toISOString()}::timestamptz
    group by 1`;
  return rows.map((r) => ({ day: r.day as string, n: Number(r.n) }));
}

export async function confusionStats(pid: string, days = 14, now = new Date()) {
  const keys = lastNDays(days, now);
  const since = dayBounds(keys[0]!, AGG_TZ).start;
  let rows: DailyCount[];
  let source: "aggregate" | "raw" = "aggregate";
  try {
    rows = await dailyFromAggregate(pid, since);
  } catch (err) {
    console.warn(`[dashboard] continuous aggregate unavailable, using plain SQL: ${(err as Error).message}`);
    rows = await dailyFromRaw(pid, since);
    source = "raw";
  }
  const byDay = new Map(rows.map((r) => [r.day, r.n]));
  const daily = keys.map((day) => ({ day, n: byDay.get(day) ?? 0 }));

  const patient = await getPatient(pid);
  const hours = await sqlClient()`
    select extract(hour from occurred_at at time zone ${patient.timezone})::int as hour, count(*)::int as n
    from patient_events
    where patient_id = ${pid} and kind = 'confused_pressed' and occurred_at >= ${since.toISOString()}::timestamptz
    group by 1`;
  const hourMap = new Map(hours.map((h) => [Number(h.hour), Number(h.n)]));
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, n: hourMap.get(hour) ?? 0 }));
  return { daily, byHour, source };
}

export type Flag =
  | { kind: "voice_mismatch"; message: string; conversationId: string; at: string }
  | { kind: "stale_phone"; message: string; deviceId: string; at: string | null }
  | { kind: "device_problem"; message: string; deviceId: string; at: string | null }
  | { kind: "alert_failed"; message: string; notificationId: string; at: string };

export async function buildDashboard(pid: string, now = new Date()) {
  const patient = await getPatient(pid);
  const tz = patient.timezone;
  const { start, end } = dayBounds(localDate(now, tz), tz);

  const [last, pending, unread, devs, todaysVisits, confusedToday, mismatches, failedAlerts] = await Promise.all([
    lastLocation(pid),
    db().select({ n: count() }).from(people).where(and(eq(people.patientId, pid), eq(people.status, "pending"))),
    db().select({ n: count() }).from(notifications).where(and(eq(notifications.patientId, pid), isNull(notifications.readAt))),
    db()
      .select({ id: devices.id, kind: devices.kind, label: devices.label, lastSeenAt: devices.lastSeenAt, capabilities: devices.capabilities })
      .from(devices)
      .where(and(eq(devices.patientId, pid), isNull(devices.revokedAt))),
    db()
      .select({ id: visits.id, personId: visits.personId, startedAt: visits.startedAt, lastSeenAt: visits.lastSeenAt, name: people.name, relationship: people.relationship, photo: people.primaryPhotoId })
      .from(visits)
      .innerJoin(people, eq(people.id, visits.personId))
      .where(and(eq(visits.patientId, pid), gte(visits.startedAt, start), lt(visits.startedAt, end)))
      .orderBy(desc(visits.startedAt)),
    sqlClient()`select count(*)::int as n from patient_events where patient_id = ${pid} and kind = 'confused_pressed' and occurred_at >= ${start.toISOString()}::timestamptz and occurred_at < ${end.toISOString()}::timestamptz`,
    db()
      .select({ id: conversations.id, claim: conversations.speakerClaim, startedAt: conversations.startedAt })
      .from(conversations)
      .where(and(eq(conversations.patientId, pid), sql`${conversations.speakerClaim} ->> 'matchesFace' = 'false'`, gte(conversations.startedAt, new Date(now.getTime() - 7 * 86400_000))))
      .orderBy(desc(conversations.startedAt))
      .limit(5),
    db()
      .select({ id: notifications.id, title: notifications.title, error: notifications.photonLastError, createdAt: notifications.createdAt })
      .from(notifications)
      .where(and(eq(notifications.patientId, pid), eq(notifications.photonStatus, "failed"), gte(notifications.createdAt, new Date(now.getTime() - 86400_000))))
      .limit(3),
  ]);

  const flags: Flag[] = [];
  for (const m of mismatches) {
    const c = m.claim as { claimedName: string; faceName?: string | null };
    flags.push({
      kind: "voice_mismatch",
      message: `Voice said ${c.claimedName}, camera said ${c.faceName ?? "someone else"}.`,
      conversationId: m.id,
      at: m.startedAt.toISOString(),
    });
  }
  for (const d of devs) {
    const status = (d.capabilities as { status?: Record<string, string> }).status ?? {};
    if (d.kind === "patient_phone" && (!d.lastSeenAt || now.getTime() - d.lastSeenAt.getTime() > STALE_PHONE_MS)) {
      flags.push({ kind: "stale_phone", message: `${d.label} hasn't sent a location for a while. Is the page still open?`, deviceId: d.id, at: d.lastSeenAt?.toISOString() ?? null });
    }
    const problems = [
      status.camera && status.camera !== "ok" ? `camera ${status.camera === "denied" ? "is blocked" : "isn't working"}` : null,
      status.faceModel === "error" ? "face recognition couldn't load" : null,
      status.microphone && status.microphone !== "ok" ? "microphone isn't available" : null,
      status.geolocation && status.geolocation !== "ok" ? `location ${status.geolocation === "denied" ? "is turned off" : "isn't working"}` : null,
    ].filter(Boolean);
    if (problems.length) {
      flags.push({ kind: "device_problem", message: `${d.label}: ${problems.join(", ")}.`, deviceId: d.id, at: (status as { at?: string }).at ?? null });
    }
  }
  for (const f of failedAlerts) {
    flags.push({ kind: "alert_failed", message: `The text alert "${f.title}" didn't reach everyone. ${friendlyDeliveryError(f.error)}`, notificationId: f.id, at: f.createdAt.toISOString() });
  }

  // A stable id per occurrence, so the caregiver can dismiss one and only see it
  // again if the problem happens again.
  const withIds = flags.map((f) => {
    const ref = "conversationId" in f ? f.conversationId : "deviceId" in f ? f.deviceId : f.notificationId;
    return { ...f, id: `${f.kind}:${ref}:${f.at ?? ""}` };
  });

  return {
    patient: { id: patient.id, name: patient.name, preferredName: patient.preferredName, timezone: tz, homeLabel: patient.homeLabel },
    geofenceState: patient.geofenceState,
    geofenceStateChangedAt: patient.geofenceStateChangedAt,
    lastLocation: last,
    pendingPeople: pending[0]?.n ?? 0,
    unreadAlerts: unread[0]?.n ?? 0,
    visitsToday: todaysVisits.map((v) => ({
      id: v.id,
      personId: v.personId,
      name: v.name,
      relationship: v.relationship,
      photoUrl: mediaUrl(v.photo),
      timeText: formatInTimeZone(v.startedAt, tz, "h:mm a"),
      minutes: Math.max(1, Math.round((v.lastSeenAt.getTime() - v.startedAt.getTime()) / 60000)),
    })),
    confusionToday: Number(confusedToday[0]?.n ?? 0),
    upcomingDates: await upcomingDates(pid, localDate(now, tz), 30),
    devices: devs.map((d) => ({
      id: d.id,
      kind: d.kind,
      label: d.label,
      lastSeenAt: d.lastSeenAt,
      online: !!d.lastSeenAt && now.getTime() - d.lastSeenAt.getTime() < 2 * 60_000,
    })),
    flags: withIds,
  };
}
