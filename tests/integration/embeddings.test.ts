import { beforeEach, expect, it } from "vitest";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makePatient } from "../support/factories";
import { POST as createPerson } from "@/app/api/patients/[pid]/people/route";
import { POST as postEmbeddings } from "@/app/api/people/[personId]/embeddings/route";
import { GET as getPerson } from "@/app/api/people/[personId]/route";
import { seededVector } from "@/client/face/mock-engine";

describeDb("face embeddings", () => {
  beforeEach(truncateAll);

  it("stores embeddings, counts them, and rejects a dim mismatch with 422", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const person = (await call(createPerson, { cookie: a.cookie, params: { pid: p.id }, body: { name: "Priya", relationship: "daughter" } })).body.person;
    const v = seededVector("x");
    const ok = await call(postEmbeddings, {
      cookie: a.cookie,
      params: { personId: person.id },
      body: { items: [1, 2, 3].map((i) => ({ vector: seededVector(`s${i}`), dim: 1024, model: "human-faceres" })) },
    });
    expect(ok.status).toBe(201);
    expect(ok.body.count).toBe(3);
    const d = await call(getPerson, { cookie: a.cookie, params: { personId: person.id } });
    expect(d.body.person.embeddingCount).toBe(3);

    const bad = await call(postEmbeddings, {
      cookie: a.cookie,
      params: { personId: person.id },
      body: { items: [{ vector: v.slice(0, 512), dim: 512, model: "human-faceres" }] },
    });
    expect(bad.status).toBe(422);

    const mismatch = await call(postEmbeddings, {
      cookie: a.cookie,
      params: { personId: person.id },
      body: { items: [{ vector: v.slice(0, 100), dim: 512, model: "human-faceres" }] },
    });
    expect(mismatch.status).toBe(422);
  });
});
