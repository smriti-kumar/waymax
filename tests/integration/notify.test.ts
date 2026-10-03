import { afterEach, beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makePatient } from "../support/factories";
import { db } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import { clearNotifyOverrides, setNotifyOverrides, type MessageSender, type SendResult } from "@/server/notify";
import { MAX_PHOTON_ATTEMPTS } from "@/server/services/notify";
import { GET as listContacts, POST as addContact } from "@/app/api/patients/[pid]/alert-contacts/route";
import { DELETE as delContact } from "@/app/api/patients/[pid]/alert-contacts/[cid]/route";
import { POST as testSend } from "@/app/api/patients/[pid]/alert-contacts/test/route";
import { POST as retry } from "@/app/api/internal/notifications/retry/route";
import { PUT as putHome } from "@/app/api/patients/[pid]/geofences/home/route";
import { POST as simulate } from "@/app/api/patients/[pid]/location/simulate/route";

class FakeSender implements MessageSender {
  readonly name = "fake";
  sent: { phones: string[]; text: string }[] = [];
  fail = false;
  async sendMany(phones: string[], text: string): Promise<SendResult[]> {
    this.sent.push({ phones, text });
    return phones.map((p) => (this.fail ? { phoneE164: p, ok: false, error: "line not assigned" } : { phoneE164: p, ok: true }));
  }
}

const worker = { authorization: `Bearer ${process.env.WORKER_SECRET}` };

async function world(opts: { contacts?: { name: string; phoneE164: string; notifyGeofence?: boolean }[] } = {}) {
  const a = await makeCaregiver();
  const p = await makePatient(a.caregiver.id);
  await call(putHome, { method: "PUT", cookie: a.cookie, params: { pid: p.id }, body: { lat: 42.444, lng: -76.5019, radiusM: 150, label: "Home" } });
  for (const c of opts.contacts ?? [
    { name: "Raj", phoneE164: "+16075550101" },
    { name: "Priya", phoneE164: "+16075550102" },
    { name: "Neighbor", phoneE164: "+16075550103", notifyGeofence: false },
  ]) {
    const r = await call(addContact, { cookie: a.cookie, params: { pid: p.id }, body: c });
    expect(r.status).toBe(201);
  }
  return { a, p };
}

const exitRow = async (pid: string) =>
  (await db().select().from(notifications).where(eq(notifications.patientId, pid))).find((n) => n.kind === "geofence_exit")!;

describeDb("notifications and Photon delivery", () => {
  beforeEach(truncateAll);
  afterEach(clearNotifyOverrides);

  it("alert contacts: list, 400 bad phone, 409 duplicate, delete", async () => {
    const { a, p } = await world();
    const l = await call(listContacts, { cookie: a.cookie, params: { pid: p.id } });
    expect(l.body.contacts).toHaveLength(3);
    expect((await call(addContact, { cookie: a.cookie, params: { pid: p.id }, body: { name: "X", phoneE164: "607-555" } })).status).toBe(400);
    expect((await call(addContact, { cookie: a.cookie, params: { pid: p.id }, body: { name: "X", phoneE164: "+16075550101" } })).status).toBe(409);
    const del = await call(delContact, { method: "DELETE", cookie: a.cookie, params: { pid: p.id, cid: l.body.contacts[0].id } });
    expect(del.status).toBe(204);
  });

  it("an exit sends one iMessage to each notify_geofence contact and marks it sent", async () => {
    const fake = new FakeSender();
    setNotifyOverrides({ mode: "photon", sender: fake });
    const { a, p } = await world();
    await call(simulate, { cookie: a.cookie, params: { pid: p.id }, body: { action: "walk_out" } });
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0].phones.sort()).toEqual(["+16075550101", "+16075550102"]);
    expect(fake.sent[0].text).toMatch(/^Waymax: Maggie has left Home/);
    expect(await exitRow(p.id)).toMatchObject({ photonStatus: "sent", photonAttempts: 1 });
  });

  it("a failed send leaves the alert pending; the retry endpoint sends it and caps at 5 attempts", async () => {
    const fake = new FakeSender();
    fake.fail = true;
    setNotifyOverrides({ mode: "photon", sender: fake });
    const { a, p } = await world();
    await call(simulate, { cookie: a.cookie, params: { pid: p.id }, body: { action: "walk_out" } });
    expect(await exitRow(p.id)).toMatchObject({ photonStatus: "pending", photonAttempts: 1 });
    expect((await exitRow(p.id)).photonLastError).toMatch(/line not assigned/);

    expect((await call(retry, { method: "POST" })).status).toBe(401);
    expect((await call(retry, { method: "POST", headers: { authorization: "Bearer wrong" } })).status).toBe(401);

    for (let i = 2; i <= MAX_PHOTON_ATTEMPTS; i++) {
      const r = await call(retry, { method: "POST", headers: worker });
      expect(r.body.retried).toBe(1);
    }
    expect(await exitRow(p.id)).toMatchObject({ photonStatus: "failed", photonAttempts: 5 });
    expect((await call(retry, { method: "POST", headers: worker })).body).toEqual({ retried: 0, sent: 0, failed: 0 });
  });

  it("retry succeeds once Photon recovers", async () => {
    const fake = new FakeSender();
    fake.fail = true;
    setNotifyOverrides({ mode: "photon", sender: fake });
    const { a, p } = await world();
    await call(simulate, { cookie: a.cookie, params: { pid: p.id }, body: { action: "walk_out" } });
    fake.fail = false;
    const r = await call(retry, { method: "POST", headers: worker });
    expect(r.body).toEqual({ retried: 1, sent: 1, failed: 0 });
    expect(await exitRow(p.id)).toMatchObject({ photonStatus: "sent", photonAttempts: 2 });
  });

  it("NOTIFY_MODE=in_app marks alerts skipped and sends nothing", async () => {
    const fake = new FakeSender();
    setNotifyOverrides({ mode: "in_app", sender: fake });
    const { a, p } = await world();
    await call(simulate, { cookie: a.cookie, params: { pid: p.id }, body: { action: "walk_out" } });
    expect(fake.sent).toHaveLength(0);
    expect((await exitRow(p.id)).photonStatus).toBe("skipped");
  });

  it("a Photon exception during delivery keeps the in-app alert", async () => {
    setNotifyOverrides({
      mode: "photon",
      sender: { name: "boom", sendMany: async () => { throw new Error("socket hang up"); } },
    });
    const { a, p } = await world();
    const r = await call(simulate, { cookie: a.cookie, params: { pid: p.id }, body: { action: "walk_out" } });
    expect(r.status).toBe(200);
    expect((await exitRow(p.id)).photonStatus).toBe("pending");
  });

  it("test button: not set up → clear message + in-app test alert; Photon down → 503", async () => {
    const { a, p } = await world();
    setNotifyOverrides({ mode: "in_app" });
    const r = await call(testSend, { method: "POST", cookie: a.cookie, params: { pid: p.id } });
    expect(r.status).toBe(200);
    expect(r.body.message).toMatch(/aren.t switched on yet/);
    const fake = new FakeSender();
    fake.fail = true;
    setNotifyOverrides({ mode: "photon", sender: fake });
    const down = await call(testSend, { method: "POST", cookie: a.cookie, params: { pid: p.id } });
    expect(down.status).toBe(503);
    expect(down.body.error.details.results).toHaveLength(2);
    const tests = (await db().select().from(notifications).where(eq(notifications.patientId, p.id))).filter((n) => n.kind === "test");
    expect(tests).toHaveLength(2);
    fake.fail = false;
    const ok = await call(testSend, { method: "POST", cookie: a.cookie, params: { pid: p.id } });
    expect(ok.body.results.every((x: any) => x.status === "sent")).toBe(true);
  });
});
