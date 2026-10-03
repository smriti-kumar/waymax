import { beforeEach, expect, it } from "vitest";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient } from "../support/factories";
import { GET as list, POST as create } from "@/app/api/patients/[pid]/questions/route";
import { PATCH as patch, DELETE as del } from "@/app/api/patients/[pid]/questions/[id]/route";
import { PUT as reorder } from "@/app/api/patients/[pid]/questions/order/route";
import { GET as patientQs } from "@/app/api/patient/questions/route";

describeDb("repeat questions", () => {
  beforeEach(truncateAll);

  it("keeps order, hides inactive ones, and returns the exact stored answer", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const d = await makeDevice(p.id, a.caregiver.id);
    const answer = "Raj is at work. He'll visit you on Sunday after lunch.  ";
    const mk = (question: string, ans = "x") => call(create, { cookie: a.cookie, params: { pid: p.id }, body: { question, answer: ans } });
    const q1 = (await mk("Where is Raj?", answer)).body.question;
    const q2 = (await mk("What day is it?", "Look at the clock screen.")).body.question;
    const q3 = (await mk("Did I eat?")).body.question;
    expect([q1.sortOrder, q2.sortOrder, q3.sortOrder]).toEqual([0, 1, 2]);

    await call(patch, { method: "PATCH", cookie: a.cookie, params: { pid: p.id, id: q3.id }, body: { isActive: false } });
    const r = await call(reorder, { method: "PUT", cookie: a.cookie, params: { pid: p.id }, body: { ids: [q2.id, q1.id, q3.id] } });
    expect(r.body.questions.map((q: any) => q.id)).toEqual([q2.id, q1.id, q3.id]);

    const shown = await call(patientQs, { cookie: d.cookie });
    expect(shown.body.questions.map((q: any) => q.question)).toEqual(["What day is it?", "Where is Raj?"]);
    // Stored trimmed by validation, then served byte-for-byte.
    expect(shown.body.questions[1].answer).toBe(answer.trim());

    const bad = await call(reorder, { method: "PUT", cookie: a.cookie, params: { pid: p.id }, body: { ids: [q1.id] } });
    expect(bad.status).toBe(422);
    expect((await call(del, { method: "DELETE", cookie: a.cookie, params: { pid: p.id, id: q3.id } })).status).toBe(204);
    expect((await call(list, { cookie: a.cookie, params: { pid: p.id } })).body.questions).toHaveLength(2);
  });
});
