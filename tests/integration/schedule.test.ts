import { beforeEach, expect, it } from "vitest";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient } from "../support/factories";
import { GET as list, POST as create } from "@/app/api/patients/[pid]/schedule/route";
import { PATCH as patch, DELETE as del } from "@/app/api/patients/[pid]/schedule/[id]/route";
import { POST as createPerson } from "@/app/api/patients/[pid]/people/route";
import { GET as today } from "@/app/api/patient/today/route";
import { buildToday } from "@/server/services/schedule";

describeDb("schedule", () => {
  beforeEach(truncateAll);

  it("creates one-off and weekly items and rejects neither/both with 422", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const ok1 = await call(create, { cookie: a.cookie, params: { pid: p.id }, body: { kind: "meal", title: "Lunch", daysOfWeek: [1, 3], startTime: "12:30" } });
    expect(ok1.status).toBe(201);
    expect(ok1.body.item.startTime).toBe("12:30");
    const ok2 = await call(create, { cookie: a.cookie, params: { pid: p.id }, body: { kind: "therapy", title: "Physio", startsAt: "2026-10-06T15:00:00Z", durationMin: 45 } });
    expect(ok2.status).toBe(201);
    const neither = await call(create, { cookie: a.cookie, params: { pid: p.id }, body: { kind: "meal", title: "x" } });
    expect(neither.status).toBe(422);
    const both = await call(create, { cookie: a.cookie, params: { pid: p.id }, body: { kind: "meal", title: "x", startsAt: "2026-10-06T15:00:00Z", daysOfWeek: [1], startTime: "10:00" } });
    expect(both.status).toBe(422);
    const l = await call(list, { cookie: a.cookie, params: { pid: p.id } });
    expect(l.body.items).toHaveLength(2);

    const u = await call(patch, { method: "PATCH", cookie: a.cookie, params: { pid: p.id, id: ok1.body.item.id }, body: { title: "Lunch together" } });
    expect(u.body.item.title).toBe("Lunch together");
    expect(u.body.item.daysOfWeek).toEqual([1, 3]);
    const switched = await call(patch, {
      method: "PATCH", cookie: a.cookie, params: { pid: p.id, id: ok1.body.item.id },
      body: { startsAt: "2026-10-07T16:00:00Z", daysOfWeek: null, startTime: null },
    });
    expect(switched.body.item.daysOfWeek).toBeNull();
    expect((await call(del, { method: "DELETE", cookie: a.cookie, params: { pid: p.id, id: ok2.body.item.id } })).status).toBe(204);
  });

  it("builds the Today card with visitors, statuses and the next line", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id, { timezone: "America/New_York" });
    const priya = (await call(createPerson, { cookie: a.cookie, params: { pid: p.id }, body: { name: "Priya", relationship: "daughter" } })).body.person;
    await call(create, { cookie: a.cookie, params: { pid: p.id }, body: { kind: "meal", title: "Breakfast", daysOfWeek: [2], startTime: "08:00", durationMin: 30 } });
    await call(create, { cookie: a.cookie, params: { pid: p.id }, body: { kind: "visit", title: "Lunch", personId: priya.id, daysOfWeek: [2], startTime: "12:30" } });
    // Tuesday 2026-10-06 at 10:00 New York
    const t = await buildToday(p.id, new Date("2026-10-06T14:00:00Z"));
    expect(t.dayName).toBe("Tuesday");
    expect(t.dateText).toBe("October 6, 2026");
    expect(t.timeText).toBe("10:00 AM");
    expect(t.partOfDay).toBe("morning");
    expect(t.locationLabel).toBe("Home");
    expect(t.items.map((i) => i.status)).toEqual(["done", "next"]);
    expect(t.nextText).toBe("Next: Lunch with Priya, 12:30");
    expect(t.visitorsToday).toEqual([expect.objectContaining({ name: "Priya", relationship: "daughter", timeText: "12:30 PM" })]);
    expect(t.emptyText).toBeNull();
    const quiet = await buildToday(p.id, new Date("2026-10-07T14:00:00Z"));
    expect(quiet.emptyText).toBe("A quiet day at home");
  });

  it("serves today to a paired display only", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const d = await makeDevice(p.id, a.caregiver.id);
    const phone = await makeDevice(p.id, a.caregiver.id, "patient_phone");
    expect((await call(today, { cookie: d.cookie })).body.preferredName).toBe("Maggie");
    expect((await call(today, { cookie: phone.cookie })).status).toBe(403);
    expect((await call(today, {})).status).toBe(401);
  });
});
