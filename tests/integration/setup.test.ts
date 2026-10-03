import { beforeEach, expect, it } from "vitest";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient, makePerson } from "../support/factories";
import { GET as status } from "@/app/api/patients/[pid]/setup-status/route";

describeDb("setup wizard progress", () => {
  beforeEach(truncateAll);
  it("is derived from the patient's data", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const empty = await call(status, { cookie: a.cookie, params: { pid: p.id } });
    expect(empty.body.steps).toEqual({ about: true, home: false, contacts: false, devices: false, people: false, schedule: false, questions: false });
    await makeDevice(p.id, a.caregiver.id);
    await makePerson(p.id);
    const later = await call(status, { cookie: a.cookie, params: { pid: p.id } });
    expect(later.body.steps).toMatchObject({ devices: true, people: true, home: false });
  });
});
