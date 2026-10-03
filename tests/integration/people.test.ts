import { beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient } from "../support/factories";
import { fakeJpeg, photoForm } from "../support/images";
import { db } from "@/server/db/client";
import { faceEmbeddings, people, personMemories } from "@/server/db/schema";
import { GET as listPeople, POST as createPerson } from "@/app/api/patients/[pid]/people/route";
import { GET as getPerson, PATCH as patchPerson, DELETE as deletePerson } from "@/app/api/people/[personId]/route";
import { POST as uploadPhoto } from "@/app/api/people/[personId]/photos/route";
import { GET as listMemories, POST as createMemory } from "@/app/api/people/[personId]/memories/route";
import { PATCH as patchMemory, DELETE as deleteMemory } from "@/app/api/people/[personId]/memories/[mid]/route";
import { GET as getMedia } from "@/app/api/media/[mediaId]/route";

async function setup() {
  const a = await makeCaregiver();
  const p = await makePatient(a.caregiver.id);
  const r = await call(createPerson, {
    cookie: a.cookie,
    params: { pid: p.id },
    body: { name: "Priya", relationship: "daughter", visitRoutine: "Sundays after lunch" },
  });
  return { a, p, person: r.body.person };
}

const upload = (cookie: string, personId: string, bytes: Buffer, extra?: Record<string, string>) =>
  call(uploadPhoto, { method: "POST", cookie, params: { personId }, rawBody: photoForm(bytes, extra) });

describeDb("people, photos and memories", () => {
  beforeEach(truncateAll);

  it("creates an approved person and lists them with counts", async () => {
    const { a, p, person } = await setup();
    expect(person.status).toBe("approved");
    expect(person.embeddingCount).toBe(0);
    const l = await call(listPeople, { cookie: a.cookie, params: { pid: p.id }, path: "/x?status=approved" });
    expect(l.body.people.map((x: any) => x.name)).toEqual(["Priya"]);
    const pending = await call(listPeople, { cookie: a.cookie, params: { pid: p.id }, path: "/x?status=pending" });
    expect(pending.body.people).toEqual([]);
  });

  it("uploads photos, first becomes primary, and serves them with access checks", async () => {
    const { a, p, person } = await setup();
    const up = await upload(a.cookie, person.id, fakeJpeg(3000, 1));
    expect(up.status).toBe(201);
    const second = await upload(a.cookie, person.id, fakeJpeg(3000, 2));
    const detail = await call(getPerson, { cookie: a.cookie, params: { personId: person.id } });
    expect(detail.body.person.primaryPhotoId).toBe(up.body.mediaId);
    expect(detail.body.person.photoUrl).toBe(`/api/media/${up.body.mediaId}`);

    const m = await call(getMedia, { cookie: a.cookie, params: { mediaId: second.body.mediaId } });
    expect(m.status).toBe(200);
    expect(m.headers.get("content-type")).toBe("image/jpeg");
    expect(m.headers.get("cache-control")).toBe("private, max-age=86400");

    // device of the same patient can read; device and caregiver of another patient cannot
    const d = await makeDevice(p.id, a.caregiver.id);
    expect((await call(getMedia, { cookie: d.cookie, params: { mediaId: up.body.mediaId } })).status).toBe(200);
    const b = await makeCaregiver();
    const pb = await makePatient(b.caregiver.id);
    const db2 = await makeDevice(pb.id, b.caregiver.id);
    expect((await call(getMedia, { cookie: b.cookie, params: { mediaId: up.body.mediaId } })).status).toBe(403);
    expect((await call(getMedia, { cookie: db2.cookie, params: { mediaId: up.body.mediaId } })).status).toBe(403);
    expect((await call(getMedia, { params: { mediaId: up.body.mediaId } })).status).toBe(401);
  });

  it("rejects photos over 2 MB with 413 and non-images with 400", async () => {
    const { a, person } = await setup();
    const big = await upload(a.cookie, person.id, fakeJpeg(2_100_000));
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe("TOO_LARGE");
    const txt = await upload(a.cookie, person.id, Buffer.from("hello, definitely not a photo"));
    expect(txt.status).toBe(400);
  });

  it("refuses to approve a pending person without a relationship (422)", async () => {
    const { a, p } = await setup();
    const [pending] = await db()
      .insert(people)
      .values({ patientId: p.id, status: "pending", createdVia: "patient_device" })
      .returning();
    const r = await call(patchPerson, {
      method: "PATCH",
      cookie: a.cookie,
      params: { personId: pending.id },
      body: { name: "Sam", status: "approved" },
    });
    expect(r.status).toBe(422);
    const ok = await call(patchPerson, {
      method: "PATCH",
      cookie: a.cookie,
      params: { personId: pending.id },
      body: { name: "Sam", relationship: "neighbor", status: "approved" },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.person.status).toBe("approved");
  });

  it("memories CRUD", async () => {
    const { a, person } = await setup();
    const up = await upload(a.cookie, person.id, fakeJpeg(1000, 9));
    const c = await call(createMemory, {
      cookie: a.cookie,
      params: { personId: person.id },
      body: { kind: "photo", title: "Beach day", body: "Cape May", mediaId: up.body.mediaId, occurredOn: "2019-07-04" },
    });
    expect(c.status).toBe(201);
    await call(createMemory, { cookie: a.cookie, params: { personId: person.id }, body: { kind: "note", title: "Loves tea" } });
    const l = await call(listMemories, { cookie: a.cookie, params: { personId: person.id } });
    expect(l.body.memories.map((m: any) => m.title)).toEqual(["Beach day", "Loves tea"]);
    const u = await call(patchMemory, {
      method: "PATCH",
      cookie: a.cookie,
      params: { personId: person.id, mid: c.body.memory.id },
      body: { title: "Beach day in Cape May" },
    });
    expect(u.body.memory.title).toBe("Beach day in Cape May");
    const d = await call(deleteMemory, { method: "DELETE", cookie: a.cookie, params: { personId: person.id, mid: c.body.memory.id } });
    expect(d.status).toBe(204);
  });

  it("deleting a person cascades embeddings and memories", async () => {
    const { a, person } = await setup();
    await db().insert(faceEmbeddings).values({ personId: person.id, model: "m", dim: 2, embedding: [0.1, 0.2], source: "upload" });
    await call(createMemory, { cookie: a.cookie, params: { personId: person.id }, body: { kind: "note", title: "x" } });
    const del = await call(deletePerson, { method: "DELETE", cookie: a.cookie, params: { personId: person.id } });
    expect(del.status).toBe(204);
    expect(await db().select().from(faceEmbeddings).where(eq(faceEmbeddings.personId, person.id))).toHaveLength(0);
    expect(await db().select().from(personMemories).where(eq(personMemories.personId, person.id))).toHaveLength(0);
  });

  it("another caregiver can't touch the person", async () => {
    const { person } = await setup();
    const b = await makeCaregiver();
    expect((await call(getPerson, { cookie: b.cookie, params: { personId: person.id } })).status).toBe(403);
  });
});
