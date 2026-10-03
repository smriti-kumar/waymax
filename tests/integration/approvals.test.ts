import { beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient, makePerson } from "../support/factories";
import { fakeJpeg } from "../support/images";
import { db } from "@/server/db/client";
import { faceEmbeddings, notifications, people } from "@/server/db/schema";
import { seededVector } from "@/client/face/mock-engine";
import { POST as addUnknown } from "@/app/api/patient/unknown-people/route";
import { GET as gallery } from "@/app/api/patient/face-gallery/route";
import { GET as listPeople } from "@/app/api/patients/[pid]/people/route";
import { PATCH as patchPerson } from "@/app/api/people/[personId]/route";
import { POST as merge } from "@/app/api/people/[personId]/merge/route";

async function world() {
  const a = await makeCaregiver();
  const p = await makePatient(a.caregiver.id);
  const d = await makeDevice(p.id, a.caregiver.id);
  const unknownVec = seededVector("waymax-unknown-visitor");
  const r = await call(addUnknown, {
    cookie: d.cookie,
    body: { embedding: unknownVec, dim: 1024, model: "human-faceres", snapshotJpegBase64: fakeJpeg(4000).toString("base64") },
  });
  expect(r.status).toBe(201);
  return { a, p, d, pendingId: r.body.personId as string };
}

const galleryIds = async (cookie: string) => ((await call(gallery, { cookie })).body.people as any[]).map((x) => x.personId);

describeDb("unknown people and approvals", () => {
  beforeEach(truncateAll);

  it("creates a pending person with snapshot, embedding and an in-app notification", async () => {
    const { a, p, pendingId } = await world();
    const [row] = await db().select().from(people).where(eq(people.id, pendingId));
    expect(row).toMatchObject({ status: "pending", createdVia: "patient_device", name: null });
    expect(row.primaryPhotoId).toBeTruthy();
    const emb = await db().select().from(faceEmbeddings).where(eq(faceEmbeddings.personId, pendingId));
    expect(emb).toHaveLength(1);
    expect(emb[0].source).toBe("webcam_capture");
    const notes = await db().select().from(notifications).where(eq(notifications.patientId, p.id));
    expect(notes).toEqual([expect.objectContaining({ kind: "person_pending", photonStatus: "skipped" })]);
    const pending = await call(listPeople, { cookie: a.cookie, params: { pid: p.id }, path: "/x?status=pending" });
    expect(pending.body.people.map((x: any) => x.id)).toEqual([pendingId]);
  });

  it("pending people are not in the face gallery; approving adds them", async () => {
    const { a, d, pendingId } = await world();
    expect(await galleryIds(d.cookie)).not.toContain(pendingId);
    const r = await call(patchPerson, {
      method: "PATCH",
      cookie: a.cookie,
      params: { personId: pendingId },
      body: { name: "Sam", relationship: "neighbor", status: "approved" },
    });
    expect(r.status).toBe(200);
    expect(await galleryIds(d.cookie)).toContain(pendingId);
  });

  it("rejecting hides the person from the gallery and the pending queue", async () => {
    const { a, p, d, pendingId } = await world();
    await call(patchPerson, { method: "PATCH", cookie: a.cookie, params: { personId: pendingId }, body: { status: "rejected" } });
    expect(await galleryIds(d.cookie)).not.toContain(pendingId);
    const pending = await call(listPeople, { cookie: a.cookie, params: { pid: p.id }, path: "/x?status=pending" });
    expect(pending.body.people).toEqual([]);
  });

  it("merge moves the embedding into the existing person and deletes the capture", async () => {
    const { a, p, d, pendingId } = await world();
    const priya = await makePerson(p.id, { name: "Priya", relationship: "daughter" });
    const r = await call(merge, { cookie: a.cookie, params: { personId: pendingId }, body: { intoPersonId: priya.id } });
    expect(r.status).toBe(200);
    expect(r.body.person.embeddingCount).toBe(4);
    expect(await db().select().from(people).where(eq(people.id, pendingId))).toHaveLength(0);
    const g = (await call(gallery, { cookie: d.cookie })).body.people;
    expect(g.find((x: any) => x.personId === priya.id).embeddings).toHaveLength(4);
  });

  it("rejects oversize and non-JPEG snapshots", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const d = await makeDevice(p.id, a.caregiver.id);
    const v = seededVector("x");
    const big = await call(addUnknown, { cookie: d.cookie, body: { embedding: v, dim: 1024, model: "m", snapshotJpegBase64: fakeJpeg(310_000).toString("base64") } });
    expect(big.status).toBe(413);
    const png = await call(addUnknown, { cookie: d.cookie, body: { embedding: v, dim: 1024, model: "m", snapshotJpegBase64: Buffer.from("not a jpeg at all!!").toString("base64") } });
    expect(png.status).toBe(400);
  });
});
