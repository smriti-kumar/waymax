import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { faceEmbeddings, people, personMemories } from "@/server/db/schema";
import { badRequest, tooLarge, unprocessable } from "@/server/http/errors";
import { MAX_MEDIA_BYTES, sniffImageMime, storage } from "@/server/storage";
import { addEmbeddings } from "./faces";
import { createInAppNotification } from "./notify";
import { getPerson, personSummary, type PersonRow } from "./people";
import { getPatient } from "./patients";

export const SNAPSHOT_MAX_BYTES = 300_000;

/** Patient tapped "Add this person": pending person + webcam embedding + snapshot + in-app alert. */
export async function addUnknownPerson(
  patientId: string,
  input: { embedding: number[]; dim: number; model: string; snapshotJpegBase64: string },
) {
  const bytes = Buffer.from(input.snapshotJpegBase64, "base64");
  if (bytes.length > SNAPSHOT_MAX_BYTES || bytes.length > MAX_MEDIA_BYTES) throw tooLarge("Snapshot must be under 300 KB");
  if (sniffImageMime(bytes) !== "image/jpeg") throw badRequest("Snapshot must be a JPEG");
  if (input.embedding.length !== input.dim) throw unprocessable("Embedding length doesn't match dim");

  const { id: mediaId } = await storage().put({ patientId, mime: "image/jpeg", bytes });
  const [person] = await db()
    .insert(people)
    .values({ patientId, status: "pending", createdVia: "patient_device", primaryPhotoId: mediaId })
    .returning();
  await addEmbeddings(person, [{ vector: input.embedding, dim: input.dim, model: input.model, mediaId }], "webcam_capture");
  const patient = await getPatient(patientId);
  await createInAppNotification({
    patientId,
    kind: "person_pending",
    title: "Someone new was seen",
    body: `${patient.preferredName} asked to add a person. Name them in Approvals.`,
    dedupeKey: `person_pending:${person.id}`,
    photonStatus: "skipped",
  });
  return { personId: person.id, status: "pending" as const };
}

/**
 * Merge a pending capture into an existing person: their face sample (and its
 * snapshot) move over, memories too, then the pending row is deleted.
 */
export async function mergeInto(source: PersonRow, targetId: string) {
  if (source.id === targetId) throw unprocessable("Choose a different person");
  const target = await getPerson(targetId);
  if (target.patientId !== source.patientId) throw unprocessable("That person belongs to another patient");
  if (target.status !== "approved") throw unprocessable("Merge into an approved person");
  await db().transaction(async (tx) => {
    await tx.update(faceEmbeddings).set({ personId: target.id }).where(eq(faceEmbeddings.personId, source.id));
    await tx.update(personMemories).set({ personId: target.id }).where(eq(personMemories.personId, source.id));
    if (!target.primaryPhotoId && source.primaryPhotoId)
      await tx.update(people).set({ primaryPhotoId: source.primaryPhotoId }).where(eq(people.id, target.id));
    await tx.delete(people).where(and(eq(people.id, source.id)));
  });
  return personSummary(target.id);
}
