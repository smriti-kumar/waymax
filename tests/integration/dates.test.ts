import { beforeEach, expect, it } from "vitest";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makePatient, makePerson } from "../support/factories";
import { GET as list, POST as add } from "@/app/api/people/[personId]/dates/route";
import { DELETE as del } from "@/app/api/people/[personId]/dates/[did]/route";
import { GET as person } from "@/app/api/people/[personId]/route";
import { buildToday } from "@/server/services/schedule";
import { upcomingDates } from "@/server/services/dates";

describeDb("important dates", () => {
  beforeEach(truncateAll);

  it("adds, lists, validates and deletes dates; Today mentions them on the day", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id, { timezone: "America/New_York" });
    const priya = await makePerson(p.id, { name: "Priya", relationship: "daughter" }, 0);
    const b = await call(add, { cookie: a.cookie, params: { personId: priya.id }, body: { kind: "birthday", month: 10, day: 6, year: 1990 } });
    expect(b.status).toBe(201);
    await call(add, { cookie: a.cookie, params: { personId: priya.id }, body: { kind: "anniversary", label: "Priya and Dev's anniversary", month: 11, day: 20 } });
    expect((await call(add, { cookie: a.cookie, params: { personId: priya.id }, body: { kind: "birthday", month: 2, day: 30 } })).status).toBe(422);
    expect((await call(list, { cookie: a.cookie, params: { personId: priya.id } })).body.dates).toHaveLength(2);
    expect((await call(person, { cookie: a.cookie, params: { personId: priya.id } })).body.dates).toHaveLength(2);

    const onTheDay = await buildToday(p.id, new Date("2026-10-06T15:00:00Z"));
    expect(onTheDay.specialToday).toEqual(["It's Priya's 36th birthday today."]);
    expect((await buildToday(p.id, new Date("2026-10-07T15:00:00Z"))).specialToday).toEqual([]);

    const soon = await upcomingDates(p.id, "2026-10-03", 60);
    expect(soon.map((u) => [u.text, u.days])).toEqual([
      ["Priya's 36th birthday", 3],
      ["Priya and Dev's anniversary", 48],
    ]);
    expect((await call(del, { method: "DELETE", cookie: a.cookie, params: { personId: priya.id, did: b.body.date.id } })).status).toBe(204);
  });
});
