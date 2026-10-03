import { afterEach, beforeEach, expect, it } from "vitest";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient, makePerson } from "../support/factories";
import { fakeJpeg, photoForm } from "../support/images";
import { clearAiOverrides, setAiOverrides } from "@/server/ai";
import type { Narrator } from "@/server/ai/interfaces";
import { POST as createMemory } from "@/app/api/people/[personId]/memories/route";
import { POST as uploadPhoto } from "@/app/api/people/[personId]/photos/route";
import { GET as slideshow } from "@/app/api/patient/people/[personId]/memories/route";

class CountingNarrator implements Narrator {
  calls = 0;
  constructor(private extra: { memoryId: string; caption: string }[] = []) {}
  async narrate(input: Parameters<Narrator["narrate"]>[0]) {
    this.calls++;
    return {
      intro: `Let's look at memories with ${input.name}.`,
      slides: [...input.memories.map((m) => ({ memoryId: m.id, caption: `Remember ${m.title}` })), ...this.extra],
      outro: "That was lovely.",
    };
  }
}

async function world() {
  const a = await makeCaregiver();
  const p = await makePatient(a.caregiver.id);
  const d = await makeDevice(p.id, a.caregiver.id);
  const priya = await makePerson(p.id, { name: "Priya", relationship: "daughter" }, 0);
  return { a, p, d, priya };
}

describeDb("memories narration", () => {
  beforeEach(truncateAll);
  afterEach(clearAiOverrides);

  it("caches the narration and reuses it while inputs are unchanged", async () => {
    const { a, d, priya } = await world();
    const n = new CountingNarrator();
    setAiOverrides({ narrator: n });
    await call(createMemory, { cookie: a.cookie, params: { personId: priya.id }, body: { kind: "story", title: "Beach day", occurredOn: "2019-07-04" } });
    await call(createMemory, { cookie: a.cookie, params: { personId: priya.id }, body: { kind: "story", title: "Graduation", occurredOn: "2021-05-20" } });
    const s1 = await call(slideshow, { cookie: d.cookie, params: { personId: priya.id } });
    expect(s1.body.intro).toBe("Let's look at memories with Priya.");
    expect(s1.body.slides.map((s: any) => s.caption)).toEqual(["Remember Graduation", "Remember Beach day"]);
    await call(slideshow, { cookie: d.cookie, params: { personId: priya.id } });
    expect(n.calls).toBe(1);
    await call(createMemory, { cookie: a.cookie, params: { personId: priya.id }, body: { kind: "note", title: "Loves tea" } });
    await call(slideshow, { cookie: d.cookie, params: { personId: priya.id } });
    expect(n.calls).toBe(2);
  });

  it("drops slides for memory ids the model invented", async () => {
    const { a, d, priya } = await world();
    setAiOverrides({ narrator: new CountingNarrator([{ memoryId: "00000000-0000-0000-0000-000000000000", caption: "Made up" }]) });
    await call(createMemory, { cookie: a.cookie, params: { personId: priya.id }, body: { kind: "story", title: "Beach day" } });
    const s = await call(slideshow, { cookie: d.cookie, params: { personId: priya.id } });
    expect(s.body.slides).toHaveLength(1);
    expect(s.body.slides[0].caption).toBe("Remember Beach day");
  });

  it("falls back to titles when the narrator fails", async () => {
    const { a, d, priya } = await world();
    setAiOverrides({ narrator: { narrate: async () => { throw new Error("down"); } } });
    await call(createMemory, { cookie: a.cookie, params: { personId: priya.id }, body: { kind: "story", title: "Beach day" } });
    const s = await call(slideshow, { cookie: d.cookie, params: { personId: priya.id } });
    expect(s.body.intro).toBe("Here are some memories with Priya, your daughter.");
    expect(s.body.slides[0].caption).toBe("Beach day");
  });

  it("a person with no photos uses the primary photo, or none (initials)", async () => {
    const { a, d, priya } = await world();
    await call(createMemory, { cookie: a.cookie, params: { personId: priya.id }, body: { kind: "note", title: "Loves tea" } });
    const none = await call(slideshow, { cookie: d.cookie, params: { personId: priya.id } });
    expect(none.body.slides[0].photoUrl).toBeNull();
    const up = await call(uploadPhoto, { method: "POST", cookie: a.cookie, params: { personId: priya.id }, rawBody: photoForm(fakeJpeg(1500)) });
    const withPrimary = await call(slideshow, { cookie: d.cookie, params: { personId: priya.id } });
    expect(withPrimary.body.slides[0].photoUrl).toBe(`/api/media/${up.body.mediaId}`);
  });

  it("a person with no memories still gets one slide", async () => {
    const { d, priya } = await world();
    const s = await call(slideshow, { cookie: d.cookie, params: { personId: priya.id } });
    expect(s.body.slides).toEqual([expect.objectContaining({ caption: "Priya, your daughter." })]);
  });
});
