import { beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient, makePerson } from "../support/factories";
import { db } from "@/server/db/client";
import { patientEvents, recognitionEvents, visits } from "@/server/db/schema";
import { recordRecognition } from "@/server/services/recognition";
import { GET as gallery } from "@/app/api/patient/face-gallery/route";
import { POST as recognize } from "@/app/api/patient/recognitions/route";
import { GET as patientPeople } from "@/app/api/patient/people/route";
import { POST as events } from "@/app/api/patient/events/route";
import { POST as status } from "@/app/api/patient/status/route";

async function world() {
  const a = await makeCaregiver();
  const p = await makePatient(a.caregiver.id, { timezone: "America/New_York" });
  const d = await makeDevice(p.id, a.caregiver.id);
  const priya = await makePerson(p.id, { name: "Priya", relationship: "daughter", spokenName: "PREE-yah" });
  return { a, p, d, priya };
}

describeDb("recognition and visits", () => {
  beforeEach(truncateAll);

  it("extends one visit while sightings are less than 5 minutes apart (rolling)", async () => {
    const { p, priya } = await world();
    const t0 = new Date("2026-10-04T15:00:00Z"); // Sunday 11:00 NY
    const r1 = await recordRecognition(p.id, null, { personId: priya.id, confidence: 0.8, source: "face" }, t0);
    const r2 = await recordRecognition(p.id, null, { personId: priya.id, confidence: 0.8, source: "face" }, new Date(t0.getTime() + 4 * 60_000));
    expect(r2.card!.visitId).toBe(r1.card!.visitId);
    // 8.5 min after the first sighting but only 4.5 after the last one: same visit.
    const r3 = await recordRecognition(p.id, null, { personId: priya.id, confidence: 0.8, source: "face" }, new Date(t0.getTime() + 8.5 * 60_000));
    expect(r3.card!.visitId).toBe(r1.card!.visitId);
  });

  it("opens a new visit once the gap since the last sighting exceeds 5 minutes", async () => {
    const { p, priya } = await world();
    const t0 = new Date("2026-10-04T15:00:00Z");
    const r1 = await recordRecognition(p.id, null, { personId: priya.id, confidence: 0.8, source: "face" }, t0);
    const r2 = await recordRecognition(p.id, null, { personId: priya.id, confidence: 0.8, source: "face" }, new Date(t0.getTime() + 6 * 60_000));
    expect(r2.card!.visitId).not.toBe(r1.card!.visitId);
    const vs = await db().select().from(visits).where(eq(visits.personId, priya.id));
    expect(vs).toHaveLength(2);
    expect(vs.find((v) => v.id === r1.card!.visitId)!.endedAt).toBeTruthy();
  });

  it("recap includes the last visit's weekday and the spoken line", async () => {
    const { p, priya } = await world();
    await recordRecognition(p.id, null, { personId: priya.id, confidence: 0.9, source: "face" }, new Date("2026-10-04T15:00:00Z")); // Sunday
    const r = await recordRecognition(p.id, null, { personId: priya.id, confidence: 0.9, source: "face" }, new Date("2026-10-06T15:00:00Z")); // Tuesday
    expect(r.card!.recap).toBe("Priya, your daughter. Last visit: Sunday.");
    expect(r.card!.sayText).toBe("This is PREE-yah, your daughter.");
    const first = await recordRecognition(p.id, null, { personId: priya.id, confidence: 0.9, source: "face" }, new Date("2026-10-06T15:20:00Z"));
    expect(first.card!.recap).toBe("Priya, your daughter. Last visit: earlier today.");
  });

  it("serves the gallery with approved people only, and records recognitions via the route", async () => {
    const { d, p, priya } = await world();
    await makePerson(p.id, { name: "Stranger", relationship: null, status: "pending", createdVia: "patient_device" }, 1);
    const g = await call(gallery, { cookie: d.cookie });
    expect(g.body.people.map((x: any) => x.personId)).toEqual([priya.id]);
    expect(g.body.people[0].embeddings).toHaveLength(3);
    expect(g.body.people[0].embeddings[0]).toHaveLength(1024);

    const r = await call(recognize, { cookie: d.cookie, body: { personId: priya.id, confidence: 0.77, source: "manual" } });
    expect(r.status).toBe(200);
    expect(r.body.card.name).toBe("Priya");
    const unknown = await call(recognize, { cookie: d.cookie, body: { personId: null, confidence: 0.3, source: "face" } });
    expect(unknown.body.card).toBeNull();
    const evs = await db().select().from(recognitionEvents);
    expect(evs.map((e) => e.source).sort()).toEqual(["face", "manual"]);

    const list = await call(patientPeople, { cookie: d.cookie });
    expect(list.body.people).toEqual([expect.objectContaining({ name: "Priya", relationship: "daughter" })]);
  });

  it("logs patient events and device status", async () => {
    const { d, p } = await world();
    expect((await call(events, { cookie: d.cookie, body: { kind: "who_is_this", payload: { personId: "x" } } })).status).toBe(204);
    expect((await call(events, { cookie: d.cookie, body: { kind: "nope" } })).status).toBe(400);
    const rows = await db().select().from(patientEvents).where(eq(patientEvents.patientId, p.id));
    expect(rows.map((r) => r.kind)).toEqual(["who_is_this"]);
    expect((await call(status, { cookie: d.cookie, body: { camera: "denied" } })).status).toBe(204);
  });

  it("a device can't recognize another patient's person", async () => {
    const { a, d } = await world();
    const other = await makePatient(a.caregiver.id);
    const raj = await makePerson(other.id, { name: "Raj", relationship: "son" });
    const r = await call(recognize, { cookie: d.cookie, body: { personId: raj.id, confidence: 0.9, source: "face" } });
    expect(r.status).toBe(404);
  });
});
