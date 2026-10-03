import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { alertContacts, devices, geofences, people, questions, scheduleItems } from "@/server/db/schema";

export const SETUP_STEPS = ["about", "home", "contacts", "devices", "people", "schedule", "questions"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** Wizard progress, derived from data (no extra table). */
export async function setupStatus(pid: string): Promise<Record<SetupStep, boolean>> {
  const n = async (q: Promise<{ n: number }[]>) => ((await q)[0]?.n ?? 0) > 0;
  const [home, contacts, devs, ppl, sched, qs] = await Promise.all([
    n(db().select({ n: count() }).from(geofences).where(and(eq(geofences.patientId, pid), eq(geofences.kind, "home")))),
    n(db().select({ n: count() }).from(alertContacts).where(eq(alertContacts.patientId, pid))),
    n(db().select({ n: count() }).from(devices).where(and(eq(devices.patientId, pid), isNull(devices.revokedAt)))),
    n(db().select({ n: count() }).from(people).where(and(eq(people.patientId, pid), eq(people.status, "approved")))),
    n(db().select({ n: count() }).from(scheduleItems).where(eq(scheduleItems.patientId, pid))),
    n(db().select({ n: count() }).from(questions).where(eq(questions.patientId, pid))),
  ]);
  return { about: true, home, contacts, devices: devs, people: ppl, schedule: sched, questions: qs };
}
