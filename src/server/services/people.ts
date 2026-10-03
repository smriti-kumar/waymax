import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { faceEmbeddings, people, personDates, personMemories } from "@/server/db/schema";
import { isUuid, requireCaregiverFor } from "@/server/auth/guards";
import { notFound, unprocessable } from "@/server/http/errors";
import { mediaUrl, storage } from "@/server/storage";
import type { MemoryDto, PersonDetail, PersonSummary } from "@/lib/contracts/people";

export type PersonRow = typeof people.$inferSelect;

export async function getPerson(personId: string): Promise<PersonRow> {
  if (!isUuid(personId)) throw notFound("Person not found");
  const [p] = await db().select().from(people).where(eq(people.id, personId));
  if (!p) throw notFound("Person not found");
  return p;
}

/** Loads a person and checks the caller is a caregiver of that person's patient. */
export async function personForCaregiver(req: NextRequest, personId: string) {
  const person = await getPerson(personId);
  const { caregiver, role } = await requireCaregiverFor(req, person.patientId);
  return { person, caregiver, role };
}

/** Primary photo, else the first enrollment photo. */
const photoIdExpr = sql<string | null>`coalesce(${people.primaryPhotoId}, (
  select fe.media_id from face_embeddings fe
  where fe.person_id = "people"."id" and fe.media_id is not null
  order by fe.created_at asc limit 1))`;

const summaryCols = {
  id: people.id,
  status: people.status,
  name: people.name,
  relationship: people.relationship,
  spokenName: people.spokenName,
  description: people.description,
  visitRoutine: people.visitRoutine,
  primaryPhotoId: people.primaryPhotoId,
  photoId: photoIdExpr,
  createdVia: people.createdVia,
  createdAt: people.createdAt,
  embeddingCount: sql<number>`(select count(*)::int from face_embeddings fe where fe.person_id = "people"."id")`,
};

type SummaryRow = {
  id: string;
  status: PersonRow["status"];
  name: string | null;
  relationship: string | null;
  spokenName: string | null;
  description: string | null;
  visitRoutine: string | null;
  primaryPhotoId: string | null;
  photoId: string | null;
  createdVia: PersonRow["createdVia"];
  createdAt: Date;
  embeddingCount: number;
};

function toSummary(r: SummaryRow): PersonSummary {
  return {
    id: r.id,
    status: r.status,
    name: r.name,
    relationship: r.relationship,
    spokenName: r.spokenName,
    description: r.description,
    visitRoutine: r.visitRoutine,
    primaryPhotoId: r.primaryPhotoId,
    photoUrl: mediaUrl(r.photoId),
    embeddingCount: Number(r.embeddingCount),
    createdVia: r.createdVia,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

export async function listPeople(patientId: string, status?: PersonRow["status"]) {
  const rows = await db()
    .select(summaryCols)
    .from(people)
    .where(and(eq(people.patientId, patientId), status ? eq(people.status, status) : undefined))
    .orderBy(asc(people.status), asc(people.name), desc(people.createdAt));
  return rows.map((r) => toSummary(r as SummaryRow));
}

export async function personSummary(personId: string): Promise<PersonSummary> {
  const [r] = await db().select(summaryCols).from(people).where(eq(people.id, personId));
  if (!r) throw notFound("Person not found");
  return toSummary(r as SummaryRow);
}

export async function createPerson(
  patientId: string,
  caregiverId: string,
  input: {
    name: string;
    relationship: string;
    spokenName: string | null;
    description: string | null;
    visitRoutine: string | null;
  },
  via: "caregiver" | "seed" = "caregiver",
) {
  const [p] = await db()
    .insert(people)
    .values({
      patientId,
      ...input,
      status: "approved",
      createdVia: via,
      approvedBy: caregiverId,
      approvedAt: new Date(),
    })
    .returning({ id: people.id });
  return personSummary(p.id);
}

export async function assertMediaOfPatient(mediaId: string, patientId: string) {
  const owner = await storage().owner(mediaId);
  if (!owner || owner.patientId !== patientId) throw unprocessable("That photo doesn't belong to this patient");
}

export async function updatePerson(
  person: PersonRow,
  caregiverId: string,
  patch: Partial<{
    name: string;
    relationship: string;
    spokenName: string | null;
    description: string | null;
    visitRoutine: string | null;
    primaryPhotoId: string | null;
    status: "approved" | "rejected";
  }>,
) {
  const next = { ...person, ...patch };
  const set: Partial<typeof people.$inferInsert> = { ...patch };
  if (patch.primaryPhotoId) await assertMediaOfPatient(patch.primaryPhotoId, person.patientId);
  if (patch.status === "approved") {
    if (!next.name || !next.relationship) throw unprocessable("Add a name and relationship before approving");
    if (person.status !== "approved") {
      set.approvedBy = caregiverId;
      set.approvedAt = new Date();
    }
  }
  await db().update(people).set(set).where(eq(people.id, person.id));
  return personSummary(person.id);
}

export async function deletePerson(personId: string) {
  await db().delete(people).where(eq(people.id, personId));
}

export async function setPrimaryIfMissing(personId: string, mediaId: string) {
  await db()
    .update(people)
    .set({ primaryPhotoId: mediaId })
    .where(and(eq(people.id, personId), sql`${people.primaryPhotoId} is null`));
}

export async function setPrimary(personId: string, mediaId: string) {
  await db().update(people).set({ primaryPhotoId: mediaId }).where(eq(people.id, personId));
}

// ---------- memories ----------

function toMemory(m: typeof personMemories.$inferSelect): MemoryDto {
  return {
    id: m.id,
    kind: m.kind,
    title: m.title,
    body: m.body,
    mediaId: m.mediaId,
    photoUrl: mediaUrl(m.mediaId),
    occurredOn: m.occurredOn,
  };
}

export async function listMemories(personId: string) {
  const rows = await db()
    .select()
    .from(personMemories)
    .where(eq(personMemories.personId, personId))
    .orderBy(sql`${personMemories.occurredOn} desc nulls last`, desc(personMemories.createdAt));
  return rows.map(toMemory);
}

export async function createMemory(
  person: PersonRow,
  input: { kind: "note" | "photo" | "story"; title: string; body: string | null; mediaId: string | null; occurredOn: string | null },
) {
  if (input.mediaId) await assertMediaOfPatient(input.mediaId, person.patientId);
  const [m] = await db()
    .insert(personMemories)
    .values({ personId: person.id, ...input })
    .returning();
  return toMemory(m);
}

export async function getMemory(personId: string, memoryId: string) {
  if (!isUuid(memoryId)) throw notFound("Memory not found");
  const [m] = await db()
    .select()
    .from(personMemories)
    .where(and(eq(personMemories.id, memoryId), eq(personMemories.personId, personId)));
  if (!m) throw notFound("Memory not found");
  return m;
}

export async function updateMemory(
  person: PersonRow,
  memoryId: string,
  patch: Partial<{ kind: "note" | "photo" | "story"; title: string; body: string | null; mediaId: string | null; occurredOn: string | null }>,
) {
  await getMemory(person.id, memoryId);
  if (patch.mediaId) await assertMediaOfPatient(patch.mediaId, person.patientId);
  const [m] = await db().update(personMemories).set(patch).where(eq(personMemories.id, memoryId)).returning();
  return toMemory(m);
}

export async function deleteMemory(personId: string, memoryId: string) {
  await getMemory(personId, memoryId);
  await db().delete(personMemories).where(eq(personMemories.id, memoryId));
}

// ---------- detail ----------

export async function personDetail(personId: string): Promise<PersonDetail> {
  const person = await personSummary(personId);
  const [embMedia, memories, dates] = await Promise.all([
    db()
      .select({ mediaId: faceEmbeddings.mediaId, n: count() })
      .from(faceEmbeddings)
      .where(and(eq(faceEmbeddings.personId, personId), isNotNull(faceEmbeddings.mediaId)))
      .groupBy(faceEmbeddings.mediaId),
    listMemories(personId),
    db()
      .select({ id: personDates.id, kind: personDates.kind, label: personDates.label, month: personDates.month, day: personDates.day, year: personDates.year })
      .from(personDates)
      .where(eq(personDates.personId, personId))
      .orderBy(asc(personDates.month), asc(personDates.day)),
  ]);
  const ids = new Map<string, { hasEmbedding: boolean }>();
  if (person.primaryPhotoId) ids.set(person.primaryPhotoId, { hasEmbedding: false });
  for (const e of embMedia) if (e.mediaId) ids.set(e.mediaId, { hasEmbedding: true });
  for (const m of memories) if (m.mediaId && !ids.has(m.mediaId)) ids.set(m.mediaId, { hasEmbedding: false });
  const photos = [...ids.entries()].map(([mediaId, v]) => ({
    mediaId,
    url: mediaUrl(mediaId)!,
    hasEmbedding: v.hasEmbedding,
    isPrimary: mediaId === person.primaryPhotoId,
  }));
  return { person, photos, memories, dates };
}

export async function peopleByIds(ids: string[]) {
  if (!ids.length) return [];
  return db().select().from(people).where(inArray(people.id, ids));
}
