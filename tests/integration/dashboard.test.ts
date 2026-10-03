import { beforeEach, expect, it } from "vitest";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient, makePerson } from "../support/factories";
import { sqlClient } from "@/server/db/client";
import { logEvent } from "@/server/services/events";
import { recordRecognition } from "@/server/services/recognition";
import { confusionStats } from "@/server/services/dashboard";
import { GET as dashboard } from "@/app/api/patients/[pid]/dashboard/route";
import { GET as confusion } from "@/app/api/patients/[pid]/confusion/route";
import { POST as simulate } from "@/app/api/patients/[pid]/location/simulate/route";
import { PUT as putHome } from "@/app/api/patients/[pid]/geofences/home/route";
import { db } from "@/server/db/client";
import { conversations } from "@/server/db/schema";

const DAY = 86400_000;

describeDb("caregiver dashboard", () => {
  beforeEach(truncateAll);

  it("aggregates state, alerts, visits, confusion and flags", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const d = await makeDevice(p.id, a.caregiver.id);
    const phone = await makeDevice(p.id, a.caregiver.id, "patient_phone");
    await sqlClient()`update devices set last_seen_at = now() - interval '20 minutes' where id = ${phone.deviceId}`;
    const priya = await makePerson(p.id, { name: "Priya", relationship: "daughter" });
    await makePerson(p.id, { name: null, relationship: null, status: "pending", createdVia: "patient_device" }, 1);
    await call(putHome, { method: "PUT", cookie: a.cookie, params: { pid: p.id }, body: { lat: 42.444, lng: -76.5019, radiusM: 150, label: "Home" } });
    await call(simulate, { cookie: a.cookie, params: { pid: p.id }, body: { action: "walk_out" } });
    await recordRecognition(p.id, d.deviceId, { personId: priya.id, confidence: 0.9, source: "face" });
    for (let i = 0; i < 3; i++) await logEvent(p.id, d.deviceId, "confused_pressed");
    await db().insert(conversations).values({
      patientId: p.id,
      personId: priya.id,
      status: "done",
      summary: "x",
      speakerClaim: { claimedName: "Sam", matchesFace: false, faceName: "Priya" },
    });

    const r = await call(dashboard, { cookie: a.cookie, params: { pid: p.id } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ geofenceState: "outside", pendingPeople: 1, unreadAlerts: 1, confusionToday: 3 });
    expect(r.body.visitsToday).toEqual([expect.objectContaining({ name: "Priya", relationship: "daughter" })]);
    expect(r.body.devices).toHaveLength(2);
    const kinds = r.body.flags.map((f: any) => f.kind).sort();
    expect(kinds).toEqual(["stale_phone", "voice_mismatch"]);
    expect(r.body.flags.find((f: any) => f.kind === "voice_mismatch").message).toBe("Voice said Sam, camera said Priya.");
  });

  it("charts 14 days of presses from the continuous aggregate, with per-hour counts", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const now = new Date();
    for (const ago of [0, 0, 1, 5, 5, 5, 20]) await logEvent(p.id, null, "confused_pressed", {}, new Date(now.getTime() - ago * DAY));
    await logEvent(p.id, null, "who_is_this", {}, now);
    const r = await call(confusion, { cookie: a.cookie, params: { pid: p.id }, path: "/x?days=14" });
    expect(r.body.daily).toHaveLength(14);
    expect(r.body.daily.reduce((s: number, d: any) => s + d.n, 0)).toBe(6); // 20 days ago is outside the window
    expect(r.body.daily.at(-1).n).toBe(2);
    expect(r.body.byHour).toHaveLength(24);
    expect(r.body.byHour.reduce((s: number, h: any) => s + h.n, 0)).toBe(6);
    expect((await confusionStats(p.id, 14)).source).toBe("aggregate");
  });

  it("falls back to plain SQL when the aggregate query errors", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    await logEvent(p.id, null, "confused_pressed");
    await sqlClient()`alter materialized view patient_events_daily rename to patient_events_daily_hidden`;
    try {
      const s = await confusionStats(p.id, 14);
      expect(s.source).toBe("raw");
      expect(s.daily.at(-1)!.n).toBe(1);
    } finally {
      await sqlClient()`alter materialized view patient_events_daily_hidden rename to patient_events_daily`;
    }
  });
});
