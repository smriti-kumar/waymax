import { beforeEach, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient } from "../support/factories";
import { db } from "@/server/db/client";
import { POST as createPatient, GET as listPatients } from "@/app/api/patients/route";
import { GET as getPatient, PATCH as patchPatient } from "@/app/api/patients/[pid]/route";
import { POST as addCaregiver } from "@/app/api/patients/[pid]/caregivers/route";
import { POST as newCode } from "@/app/api/patients/[pid]/pairing-codes/route";
import { POST as pair } from "@/app/api/devices/pair/route";
import { GET as deviceMe } from "@/app/api/devices/me/route";
import { GET as listDevices } from "@/app/api/patients/[pid]/devices/route";
import { DELETE as revoke } from "@/app/api/patients/[pid]/devices/[did]/route";

describeDb("patients", () => {
  beforeEach(truncateAll);

  it("creates a patient, links the caller as owner, and reads it back", async () => {
    const { cookie } = await makeCaregiver();
    const c = await call(createPatient, {
      cookie,
      body: { name: "Margaret Lee", preferredName: "Maggie", timezone: "America/New_York" },
    });
    expect(c.status).toBe(201);
    const pid = c.body.patient.id;
    const g = await call(getPatient, { cookie, params: { pid } });
    expect(g.status).toBe(200);
    expect(g.body.patient.preferredName).toBe("Maggie");
    expect(g.body.homeFence).toBeNull();
    expect(g.body.lastLocation).toBeNull();
    const l = await call(listPatients, { cookie });
    expect(l.body.patients[0].role).toBe("owner");
  });

  it("rejects an unknown timezone", async () => {
    const { cookie } = await makeCaregiver();
    const c = await call(createPatient, { cookie, body: { name: "M", preferredName: "M", timezone: "Mars/Olympus" } });
    expect(c.status).toBe(400);
  });

  it("patches fields and enforces access", async () => {
    const a = await makeCaregiver();
    const b = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const ok = await call(patchPatient, { cookie: a.cookie, params: { pid: p.id }, method: "PATCH", body: { homeLabel: "The cottage" } });
    expect(ok.body.patient.homeLabel).toBe("The cottage");
    const no = await call(patchPatient, { cookie: b.cookie, params: { pid: p.id }, method: "PATCH", body: { name: "X" } });
    expect(no.status).toBe(403);
  });

  it("adds a co-caregiver by email (owner only), 404 unknown, 409 duplicate", async () => {
    const a = await makeCaregiver();
    const b = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const add = () => call(addCaregiver, { cookie: a.cookie, params: { pid: p.id }, body: { email: b.caregiver.email } });
    expect((await add()).status).toBe(201);
    expect((await add()).status).toBe(409);
    const missing = await call(addCaregiver, { cookie: a.cookie, params: { pid: p.id }, body: { email: "nobody@example.com" } });
    expect(missing.status).toBe(404);
    // b can now read the patient, but as a member can't add others
    expect((await call(getPatient, { cookie: b.cookie, params: { pid: p.id } })).status).toBe(200);
    const byMember = await call(addCaregiver, { cookie: b.cookie, params: { pid: p.id }, body: { email: a.caregiver.email } });
    expect(byMember.status).toBe(403);
  });
});

describeDb("pairing and devices", () => {
  beforeEach(truncateAll);

  it("pairs with a code exactly once and sets a device cookie", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const code = await call(newCode, { cookie: a.cookie, params: { pid: p.id }, body: { deviceKind: "patient_display" } });
    expect(code.status).toBe(201);
    expect(code.body.code).toMatch(/^\d{6}$/);

    const first = await call(pair, { body: { code: code.body.code, label: "Kitchen laptop" } });
    expect(first.status).toBe(201);
    expect(first.body.kind).toBe("patient_display");
    expect(first.cookies.wm_device).toBe(first.body.token);

    const second = await call(pair, { body: { code: code.body.code, label: "Again" } });
    expect(second.status).toBe(400);

    const me = await call(deviceMe, { cookie: `wm_device=${first.body.token}` });
    expect(me.body.patient.preferredName).toBe("Maggie");
    const viaHeader = await call(deviceMe, { headers: { authorization: `Device ${first.body.token}` } });
    expect(viaHeader.status).toBe(200);
  });

  it("rejects a code after 10 minutes", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const code = await call(newCode, { cookie: a.cookie, params: { pid: p.id }, body: { deviceKind: "patient_phone" } });
    const expiresIn = new Date(code.body.expiresAt).getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(9.9 * 60_000);
    expect(expiresIn).toBeLessThanOrEqual(10 * 60_000);
    await db().execute(sql`update pairing_codes set expires_at = now() - interval '1 second'`);
    const r = await call(pair, { body: { code: code.body.code } });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("VALIDATION");
  });

  it("revoked devices get 401", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const d = await makeDevice(p.id, a.caregiver.id);
    expect((await call(deviceMe, { cookie: d.cookie })).status).toBe(200);
    const list = await call(listDevices, { cookie: a.cookie, params: { pid: p.id } });
    expect(list.body.devices).toHaveLength(1);
    expect(list.body.devices[0].lastSeenAt).toBeTruthy();
    const del = await call(revoke, { method: "DELETE", cookie: a.cookie, params: { pid: p.id, did: d.deviceId } });
    expect(del.status).toBe(204);
    expect((await call(deviceMe, { cookie: d.cookie })).status).toBe(401);
  });

  it("a device of patient A is scoped to A and can't use caregiver routes for B", async () => {
    const a = await makeCaregiver();
    const b = await makeCaregiver();
    const pa = await makePatient(a.caregiver.id, { preferredName: "Ann" });
    const pb = await makePatient(b.caregiver.id, { preferredName: "Bea" });
    const d = await makeDevice(pa.id, a.caregiver.id);
    const me = await call(deviceMe, { cookie: d.cookie });
    expect(me.body.patient.id).toBe(pa.id);
    const cross = await call(getPatient, { cookie: d.cookie, params: { pid: pb.id } });
    expect(cross.status).toBe(401);
    // caregiver B can't revoke A's device
    const del = await call(revoke, { method: "DELETE", cookie: b.cookie, params: { pid: pa.id, did: d.deviceId } });
    expect(del.status).toBe(403);
  });
});
