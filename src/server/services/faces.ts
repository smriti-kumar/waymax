import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/server/db/client";
import { faceEmbeddings, people } from "@/server/db/schema";
import { unprocessable } from "@/server/http/errors";
import { assertMediaOfPatient, type PersonRow } from "./people";
import { mediaUrl } from "@/server/storage";

export type EmbeddingItem = { vector: number[]; dim: number; model: string; mediaId?: string | null };

/** Dimension already used for `model` by any person of this patient, if any. */
async function existingDim(patientId: string, model: string) {
  const [row] = await db()
    .select({ dim: faceEmbeddings.dim })
    .from(faceEmbeddings)
    .innerJoin(people, eq(people.id, faceEmbeddings.personId))
    .where(and(eq(people.patientId, patientId), eq(faceEmbeddings.model, model)))
    .limit(1);
  return row?.dim ?? null;
}

export async function addEmbeddings(
  person: PersonRow,
  items: EmbeddingItem[],
  source: "upload" | "webcam_capture" = "upload",
) {
  for (const it of items) {
    if (it.vector.length !== it.dim) throw unprocessable(`Embedding length ${it.vector.length} doesn't match dim ${it.dim}`);
    const dim = await existingDim(person.patientId, it.model);
    if (dim !== null && dim !== it.dim)
      throw unprocessable(`Embedding dim ${it.dim} doesn't match existing ${dim} for model ${it.model}`);
    if (it.mediaId) await assertMediaOfPatient(it.mediaId, person.patientId);
  }
  await db()
    .insert(faceEmbeddings)
    .values(
      items.map((it) => ({
        personId: person.id,
        model: it.model,
        dim: it.dim,
        embedding: it.vector,
        source,
        mediaId: it.mediaId ?? null,
      })),
    );
  return items.length;
}

/** Approved people of a patient with their embeddings (the patient-side gallery). */
export async function faceGallery(patientId: string) {
  const rows = await db()
    .select({
      personId: people.id,
      name: people.name,
      relationship: people.relationship,
      primaryPhotoId: people.primaryPhotoId,
      model: faceEmbeddings.model,
      embedding: faceEmbeddings.embedding,
      mediaId: faceEmbeddings.mediaId,
    })
    .from(people)
    .innerJoin(faceEmbeddings, eq(faceEmbeddings.personId, people.id))
    .where(and(eq(people.patientId, patientId), eq(people.status, "approved")))
    .orderBy(people.id, faceEmbeddings.createdAt);
  const byPerson = new Map<
    string,
    { personId: string; name: string; relationship: string; photoId: string | null; embeddings: number[][]; model: string }
  >();
  for (const r of rows) {
    let p = byPerson.get(r.personId);
    if (!p) {
      p = {
        personId: r.personId,
        name: r.name!,
        relationship: r.relationship!,
        photoId: r.primaryPhotoId ?? r.mediaId,
        embeddings: [],
        model: r.model,
      };
      byPerson.set(r.personId, p);
    }
    p.embeddings.push(r.embedding);
  }
  return [...byPerson.values()];
}

/** Moves every embedding of `fromId` onto `toId` (approval "merge"). */
export async function moveEmbeddings(fromId: string, toId: string) {
  await db()
    .update(faceEmbeddings)
    .set({ personId: toId })
    .where(and(eq(faceEmbeddings.personId, fromId), ne(faceEmbeddings.personId, toId)));
}

export async function approvedPeople(patientId: string) {
  const rows = await db()
    .select({ id: people.id, name: people.name, relationship: people.relationship, photo: people.primaryPhotoId })
    .from(people)
    .where(and(eq(people.patientId, patientId), eq(people.status, "approved")))
    .orderBy(people.name);
  return rows.map((r) => ({ personId: r.id, name: r.name!, relationship: r.relationship!, photoUrl: mediaUrl(r.photo) }));
}
