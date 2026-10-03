// Expands schedule items for one local day in the patient's timezone and labels
// each one done | now | next | later. Pure: shared by server and tests.
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type ScheduleKind = "visit" | "activity" | "therapy" | "meal" | "other";
export type ItemStatus = "done" | "now" | "next" | "later";

export interface ScheduleItemLike {
  id: string;
  kind: ScheduleKind;
  title: string;
  personId: string | null;
  startsAt: Date | string | null;
  daysOfWeek: number[] | null;
  startTime: string | null; // "HH:MM" or "HH:MM:SS", patient local
  durationMin: number;
  notes?: string | null;
}

export interface DayItem {
  id: string;
  kind: ScheduleKind;
  title: string;
  personId: string | null;
  startsAt: Date;
  endsAt: Date;
  status: ItemStatus;
}

/** "YYYY-MM-DD" of `at` in `tz`. */
export function localDate(at: Date, tz: string) {
  return formatInTimeZone(at, tz, "yyyy-MM-dd");
}

/** Day of week (0=Sun..6=Sat) of a "YYYY-MM-DD" calendar date. */
export function dayOfWeek(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + n));
  return t.toISOString().slice(0, 10);
}

/** UTC instants bounding the local calendar day. */
export function dayBounds(ymd: string, tz: string) {
  return { start: fromZonedTime(`${ymd}T00:00:00`, tz), end: fromZonedTime(`${addDays(ymd, 1)}T00:00:00`, tz) };
}

function normTime(t: string) {
  const [h = "0", m = "0", s = "0"] = t.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.slice(0, 2).padStart(2, "0")}`;
}

/** Items happening on the local day `ymd`, sorted by start, with statuses relative to `now`. */
export function expandDay(items: ScheduleItemLike[], ymd: string, tz: string, now: Date): DayItem[] {
  const { start, end } = dayBounds(ymd, tz);
  const dow = dayOfWeek(ymd);
  const out: Omit<DayItem, "status">[] = [];
  for (const it of items) {
    let s: Date | null = null;
    if (it.startsAt) {
      const t = new Date(it.startsAt);
      if (t >= start && t < end) s = t;
    } else if (it.daysOfWeek?.includes(dow) && it.startTime) {
      s = fromZonedTime(`${ymd}T${normTime(it.startTime)}`, tz);
    }
    if (!s) continue;
    out.push({
      id: it.id,
      kind: it.kind,
      title: it.title,
      personId: it.personId,
      startsAt: s,
      endsAt: new Date(s.getTime() + it.durationMin * 60_000),
    });
  }
  out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.title.localeCompare(b.title));
  let nextAssigned = false;
  return out.map((it) => {
    let status: ItemStatus;
    if (it.endsAt <= now) status = "done";
    else if (it.startsAt <= now) status = "now";
    else if (!nextAssigned) {
      status = "next";
      nextAssigned = true;
    } else status = "later";
    return { ...it, status };
  });
}

export type PartOfDay = "morning" | "afternoon" | "evening" | "night";

export function partOfDay(at: Date, tz: string): PartOfDay {
  const h = Number(formatInTimeZone(at, tz, "H"));
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export const timeText = (at: Date, tz: string) => formatInTimeZone(at, tz, "h:mm a");
export const dayName = (at: Date, tz: string) => formatInTimeZone(at, tz, "EEEE");
export const dateText = (at: Date, tz: string) => formatInTimeZone(at, tz, "MMMM d, yyyy");

export const EMPTY_DAY_TEXT = "A quiet day at home";

/** "Next: Lunch with Priya, 12:30" */
export function nextLine(items: (DayItem & { personName?: string | null })[], tz: string): string | null {
  const n = items.find((i) => i.status === "next");
  if (!n) return null;
  const who = n.personName && !n.title.includes(n.personName) ? ` with ${n.personName}` : "";
  return `Next: ${n.title}${who}, ${formatInTimeZone(n.startsAt, tz, "h:mm")}`;
}
