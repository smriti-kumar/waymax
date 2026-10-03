import { z } from "zod";
import { nonEmpty, optionalText, uuid } from "./common";

const kind = z.enum(["visit", "activity", "therapy", "meal", "other"]);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use HH:MM");

/** One-off ({startsAt}) or weekly ({daysOfWeek, startTime}); the service rejects neither/both with 422. */
export const scheduleBody = z.object({
  kind,
  title: nonEmpty(120),
  personId: uuid.nullish().transform((v) => v ?? null),
  startsAt: z.iso.datetime({ offset: true }).nullish(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).nullish(),
  startTime: time.nullish(),
  durationMin: z.number().int().min(5).max(720).default(60),
  notes: optionalText(500),
});
export type ScheduleBody = z.infer<typeof scheduleBody>;

export const patchScheduleBody = scheduleBody.partial();

export type ScheduleItemDto = {
  id: string;
  kind: z.infer<typeof kind>;
  title: string;
  personId: string | null;
  personName: string | null;
  startsAt: string | null;
  daysOfWeek: number[] | null;
  startTime: string | null;
  durationMin: number;
  notes: string | null;
};

export type TodayItem = {
  id: string;
  title: string;
  kind: z.infer<typeof kind>;
  startsAt: string;
  endsAt: string;
  status: "done" | "now" | "next" | "later";
  timeText: string;
  personName: string | null;
};

export type TodayResponse = {
  now: string;
  timezone: string;
  preferredName: string;
  dayName: string;
  dateText: string;
  timeText: string;
  partOfDay: "morning" | "afternoon" | "evening" | "night";
  locationLabel: string;
  visitorsToday: { personId: string; name: string; relationship: string; photoUrl: string | null; timeText: string }[];
  items: TodayItem[];
  nextText: string | null;
  emptyText: string | null;
  /** "It's Priya's birthday today." lines for dates that fall today. */
  specialToday: string[];
};
