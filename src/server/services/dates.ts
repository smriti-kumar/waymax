import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { people, personDates } from "@/server/db/schema";
import { notFound, unprocessable } from "@/server/http/errors";
import { isUuid } from "@/server/auth/guards";
import { daysUntil, describeDate, formatMonthDay } from "@/lib/dates";

export type DateInput = { kind: "birthday" | "anniversary" | "other"; label: string | null; month: number; day: number; year: number | null };

function validDay(month: number, day: number) {
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
  if (day > max) throw unprocessable(`That month has only ${max} days`);
}

export async function listDates(personId: string) {
  return db().select().from(personDates).where(eq(personDates.personId, personId)).orderBy(asc(personDates.month), asc(personDates.day));
}

export async function addDate(personId: string, input: DateInput) {
  validDay(input.month, input.day);
  const [row] = await db().insert(personDates).values({ personId, ...input }).returning();
  return row;
}

export async function deleteDate(personId: string, dateId: string) {
  if (!isUuid(dateId)) throw notFound("Date not found");
  const rows = await db()
    .delete(personDates)
    .where(and(eq(personDates.id, dateId), eq(personDates.personId, personId)))
    .returning({ id: personDates.id });
  if (!rows.length) throw notFound("Date not found");
}

/** Approved people's yearly dates within `withinDays` of the patient's local `today` ("YYYY-MM-DD"). */
export async function upcomingDates(patientId: string, today: string, withinDays = 30) {
  const rows = await db()
    .select({ d: personDates, name: people.name, personId: people.id })
    .from(personDates)
    .innerJoin(people, eq(people.id, personDates.personId))
    .where(and(eq(people.patientId, patientId), eq(people.status, "approved")));
  return rows
    .map(({ d, name, personId }) => {
      const { days, year } = daysUntil(d, today);
      return {
        id: d.id,
        personId,
        kind: d.kind,
        days,
        dateText: formatMonthDay(d),
        text: describeDate(d, name ?? "Someone", year),
      };
    })
    .filter((x) => x.days <= withinDays)
    .sort((a, b) => a.days - b.days || a.text.localeCompare(b.text));
}
