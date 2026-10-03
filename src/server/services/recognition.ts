import "server-only";
import { and, desc, eq, isNotNull, lt, ne } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/server/db/client";
import { conversations, people, recognitionEvents, visits } from "@/server/db/schema";
import { notFound } from "@/server/http/errors";
import { mediaUrl } from "@/server/storage";
import { buildRecap, buildSayText } from "@/lib/text";
import { localDate } from "@/lib/schedule";
import type { PersonCardDto } from "@/lib/contracts/patient";
import { getPatient } from "./patients";

export const VISIT_GAP_MS = 5 * 60 * 1000;

/** Extends the person's latest open visit if seen within 5 minutes, else opens a new one. */
export async function openOrExtendVisit(patientId: string, personId: string, now = new Date()) {
  return db().transaction(async (tx) => {
    const [last] = await tx
      .select()
      .from(visits)
      .where(and(eq(visits.patientId, patientId), eq(visits.personId, personId)))
      .orderBy(desc(visits.startedAt))
      .limit(1)
      .for("update");
    if (last && !last.endedAt && now.getTime() - last.lastSeenAt.getTime() <= VISIT_GAP_MS) {
      const seen = now > last.lastSeenAt ? now : last.lastSeenAt;
      await tx.update(visits).set({ lastSeenAt: seen }).where(eq(visits.id, last.id));
      return { visitId: last.id, opened: false };
    }
    if (last && !last.endedAt) await tx.update(visits).set({ endedAt: last.lastSeenAt }).where(eq(visits.id, last.id));
    const [v] = await tx.insert(visits).values({ patientId, personId, startedAt: now, lastSeenAt: now }).returning();
    return { visitId: v.id, opened: true };
  });
}

/** The recap card for a person, built from data only (no LLM). */
export async function personCard(patientId: string, personId: string, currentVisitId: string, now = new Date()): Promise<PersonCardDto> {
  const [p] = await db()
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.patientId, patientId), eq(people.status, "approved")));
  if (!p) throw notFound("Person not found");
  const patient = await getPatient(patientId);
  const tz = patient.timezone;

  const [prev] = await db()
    .select({ startedAt: visits.startedAt })
    .from(visits)
    .where(and(eq(visits.personId, personId), ne(visits.id, currentVisitId), lt(visits.startedAt, now)))
    .orderBy(desc(visits.startedAt))
    .limit(1);

  const [convo] = await db()
    .select({ summary: conversations.summary, keyFacts: conversations.keyFacts })
    .from(conversations)
    .where(and(eq(conversations.personId, personId), eq(conversations.status, "done"), isNotNull(conversations.summary)))
    .orderBy(desc(conversations.startedAt))
    .limit(1);
  const lastFact = convo?.keyFacts?.[0] ?? convo?.summary ?? null;

  const recap = buildRecap({
    name: p.name!,
    relationship: p.relationship,
    lastVisit: prev
      ? {
          at: prev.startedAt,
          isToday: localDate(prev.startedAt, tz) === localDate(now, tz),
          weekday: formatInTimeZone(prev.startedAt, tz, "EEEE"),
        }
      : null,
    lastFact,
  });

  return {
    personId: p.id,
    name: p.name!,
    relationship: p.relationship!,
    photoUrl: mediaUrl(p.primaryPhotoId),
    recap,
    sayText: buildSayText(p.name!, p.spokenName, p.relationship),
    visitId: currentVisitId,
  };
}

export async function recordRecognition(
  patientId: string,
  deviceId: string | null,
  input: { personId: string | null; confidence: number; source: "face" | "manual" | "voice" },
  now = new Date(),
) {
  if (input.personId) {
    const [p] = await db()
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.id, input.personId), eq(people.patientId, patientId), eq(people.status, "approved")));
    if (!p) throw notFound("Person not found");
  }
  await db().insert(recognitionEvents).values({
    patientId,
    deviceId,
    personId: input.personId,
    source: input.source,
    confidence: input.confidence,
    detectedAt: now,
  });
  if (!input.personId) return { card: null };
  const { visitId } = await openOrExtendVisit(patientId, input.personId, now);
  return { card: await personCard(patientId, input.personId, visitId, now) };
}
