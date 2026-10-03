import "server-only";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/server/db/client";
import { geofences, people, scheduleItems, visits } from "@/server/db/schema";
import { notFound, unprocessable } from "@/server/http/errors";
import { isUuid } from "@/server/auth/guards";
import type { ScheduleBody, ScheduleItemDto, TodayResponse } from "@/lib/contracts/schedule";
import {
  EMPTY_DAY_TEXT,
  dateText,
  dayBounds,
  dayName,
  expandDay,
  localDate,
  nextLine,
  partOfDay,
  timeText,
} from "@/lib/schedule";
import { pickActiveFence } from "@/lib/geo";
import { mediaUrl } from "@/server/storage";
import { getPatient } from "./patients";

type Row = typeof scheduleItems.$inferSelect;

function style(v: { startsAt?: string | Date | null; daysOfWeek?: number[] | null; startTime?: string | null }) {
  const oneOff = v.startsAt != null;
  const weekly = v.daysOfWeek != null && v.daysOfWeek.length > 0 && v.startTime != null;
  if (oneOff === weekly) throw unprocessable("Choose either a single date and time, or days of the week and a time");
  return oneOff ? "oneoff" : "weekly";
}

async function assertPersonOfPatient(personId: string | null | undefined, patientId: string) {
  if (!personId) return;
  const [p] = await db().select({ patientId: people.patientId }).from(people).where(eq(people.id, personId));
  if (!p || p.patientId !== patientId) throw unprocessable("That person isn't in this patient's list");
}

async function toDto(rows: Row[]): Promise<ScheduleItemDto[]> {
  const ids = [...new Set(rows.map((r) => r.personId).filter((x): x is string => !!x))];
  const names = ids.length
    ? new Map(
        (await db().select({ id: people.id, name: people.name }).from(people).where(inArray(people.id, ids))).map((p) => [
          p.id,
          p.name,
        ]),
      )
    : new Map<string, string | null>();
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    personId: r.personId,
    personName: r.personId ? (names.get(r.personId) ?? null) : null,
    startsAt: r.startsAt ? r.startsAt.toISOString() : null,
    daysOfWeek: r.daysOfWeek,
    startTime: r.startTime ? r.startTime.slice(0, 5) : null,
    durationMin: r.durationMin,
    notes: r.notes,
  }));
}

export async function listSchedule(patientId: string) {
  const rows = await db()
    .select()
    .from(scheduleItems)
    .where(eq(scheduleItems.patientId, patientId))
    .orderBy(asc(scheduleItems.startTime), asc(scheduleItems.startsAt), asc(scheduleItems.createdAt));
  return toDto(rows);
}

export async function createScheduleItem(patientId: string, body: ScheduleBody) {
  const s = style(body);
  await assertPersonOfPatient(body.personId, patientId);
  const [row] = await db()
    .insert(scheduleItems)
    .values({
      patientId,
      kind: body.kind,
      title: body.title,
      personId: body.personId,
      startsAt: s === "oneoff" ? new Date(body.startsAt!) : null,
      daysOfWeek: s === "weekly" ? [...new Set(body.daysOfWeek!)].sort() : null,
      startTime: s === "weekly" ? body.startTime! : null,
      durationMin: body.durationMin,
      notes: body.notes,
    })
    .returning();
  return (await toDto([row]))[0]!;
}

async function getItem(patientId: string, id: string) {
  if (!isUuid(id)) throw notFound("Schedule item not found");
  const [row] = await db()
    .select()
    .from(scheduleItems)
    .where(and(eq(scheduleItems.id, id), eq(scheduleItems.patientId, patientId)));
  if (!row) throw notFound("Schedule item not found");
  return row;
}

export async function updateScheduleItem(patientId: string, id: string, patch: Partial<ScheduleBody>) {
  const cur = await getItem(patientId, id);
  const merged = {
    startsAt: patch.startsAt !== undefined ? patch.startsAt : cur.startsAt,
    daysOfWeek: patch.daysOfWeek !== undefined ? patch.daysOfWeek : cur.daysOfWeek,
    startTime: patch.startTime !== undefined ? patch.startTime : cur.startTime,
  };
  const s = style(merged);
  if (patch.personId !== undefined) await assertPersonOfPatient(patch.personId, patientId);
  const [row] = await db()
    .update(scheduleItems)
    .set({
      ...(patch.kind ? { kind: patch.kind } : {}),
      ...(patch.title ? { title: patch.title } : {}),
      ...(patch.personId !== undefined ? { personId: patch.personId } : {}),
      ...(patch.durationMin ? { durationMin: patch.durationMin } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      startsAt: s === "oneoff" ? new Date(merged.startsAt!) : null,
      daysOfWeek: s === "weekly" ? merged.daysOfWeek : null,
      startTime: s === "weekly" ? merged.startTime : null,
    })
    .where(eq(scheduleItems.id, id))
    .returning();
  return (await toDto([row]))[0]!;
}

export async function deleteScheduleItem(patientId: string, id: string) {
  await getItem(patientId, id);
  await db().delete(scheduleItems).where(eq(scheduleItems.id, id));
}

/** Today's expanded items for the patient (shared by Today card and calming mode). */
export async function todayItems(patientId: string, tz: string, now = new Date()) {
  const rows = await db().select().from(scheduleItems).where(eq(scheduleItems.patientId, patientId));
  const day = expandDay(rows, localDate(now, tz), tz, now);
  const dtos = await toDto(rows);
  const names = new Map(dtos.map((d) => [d.id, d.personName]));
  return day.map((d) => ({ ...d, personName: names.get(d.id) ?? null }));
}

export async function locationLabelFor(patientId: string, homeLabel: string, state: string) {
  const fences = await db().select().from(geofences).where(eq(geofences.patientId, patientId));
  const active = pickActiveFence(fences);
  if (active?.kind === "temporary" && state !== "outside") return active.label;
  return homeLabel;
}

export async function buildToday(patientId: string, now = new Date()): Promise<TodayResponse> {
  const patient = await getPatient(patientId);
  const tz = patient.timezone;
  const items = await todayItems(patientId, tz, now);

  // Visitors: people scheduled today plus anyone who actually visited today.
  const { start, end } = dayBounds(localDate(now, tz), tz);
  const visited = await db()
    .select({ personId: visits.personId, startedAt: visits.startedAt })
    .from(visits)
    .where(and(eq(visits.patientId, patientId), gte(visits.startedAt, start), lt(visits.startedAt, end)))
    .orderBy(asc(visits.startedAt));
  const visitorTimes = new Map<string, Date>();
  for (const it of items) if (it.personId && !visitorTimes.has(it.personId)) visitorTimes.set(it.personId, it.startsAt);
  for (const v of visited) if (!visitorTimes.has(v.personId)) visitorTimes.set(v.personId, v.startedAt);
  const ids = [...visitorTimes.keys()];
  const ppl = ids.length
    ? await db()
        .select({ id: people.id, name: people.name, relationship: people.relationship, photo: people.primaryPhotoId, status: people.status })
        .from(people)
        .where(inArray(people.id, ids))
    : [];
  const visitorsToday = ppl
    .filter((p) => p.status === "approved" && p.name)
    .map((p) => ({
      personId: p.id,
      name: p.name!,
      relationship: p.relationship ?? "",
      photoUrl: mediaUrl(p.photo),
      timeText: timeText(visitorTimes.get(p.id)!, tz),
      at: visitorTimes.get(p.id)!.getTime(),
    }))
    .sort((a, b) => a.at - b.at)
    .map(({ at: _at, ...rest }) => rest);

  return {
    now: now.toISOString(),
    timezone: tz,
    preferredName: patient.preferredName,
    dayName: dayName(now, tz),
    dateText: dateText(now, tz),
    timeText: timeText(now, tz),
    partOfDay: partOfDay(now, tz),
    locationLabel: await locationLabelFor(patientId, patient.homeLabel, patient.geofenceState),
    visitorsToday,
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      kind: i.kind,
      startsAt: i.startsAt.toISOString(),
      endsAt: i.endsAt.toISOString(),
      status: i.status,
      timeText: timeText(i.startsAt, tz),
      personName: i.personName,
    })),
    nextText: nextLine(items, tz),
    emptyText: items.length ? null : EMPTY_DAY_TEXT,
  };
}
