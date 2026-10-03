import { afterEach, beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient, makePerson } from "../support/factories";
import { wavOf } from "../support/wav";
import { db } from "@/server/db/client";
import { recognitionEvents } from "@/server/db/schema";
import { clearAiOverrides, setAiOverrides } from "@/server/ai";
import { MockTranscriber } from "@/server/ai/mocks";
import type { Transcription } from "@/server/ai/interfaces";
import { recordRecognition } from "@/server/services/recognition";
import { POST as start } from "@/app/api/conversations/route";
import { POST as chunk } from "@/app/api/conversations/[cid]/chunks/route";
import { POST as finish } from "@/app/api/conversations/[cid]/finish/route";
import { GET as getConvo } from "@/app/api/conversations/[cid]/route";
import { GET as listConvos } from "@/app/api/patients/[pid]/conversations/route";

async function world() {
  const a = await makeCaregiver();
  const p = await makePatient(a.caregiver.id);
  const d = await makeDevice(p.id, a.caregiver.id);
  const priya = await makePerson(p.id, { name: "Priya", relationship: "daughter" });
  const sam = await makePerson(p.id, { name: "Sam", relationship: "neighbor" });
  return { a, p, d, priya, sam };
}

const send = (cookie: string, cid: string, seq: number, body = wavOf(2)) =>
  call(chunk, { method: "POST", cookie, params: { cid }, path: `/x?seq=${seq}`, rawBody: new Uint8Array(body), headers: { "content-type": "audio/wav" } });

function scripted(map: Record<number, Transcription | Error>) {
  return new MockTranscriber((wav) => {
    // The chunk length (in tenths of a second) selects the scripted reply.
    const key = Math.round((wav.length - 44) / 3200);
    const r = map[key];
    if (r instanceof Error) throw r;
    return r ?? { segments: [], selfIntroductions: [] };
  });
}

describeDb("Listen → transcription → summary → voice cross-check", () => {
  beforeEach(truncateAll);
  afterEach(clearAiOverrides);

  it("transcribes chunks in seq order even when uploaded out of order, then summarizes", async () => {
    const { a, p, d, priya } = await world();
    setAiOverrides({
      transcriber: scripted({
        10: { segments: [{ speaker: "A", text: "Hi Mom, it's Priya." }], selfIntroductions: [{ name: "Priya", quote: "it's Priya" }] },
        20: { segments: [{ speaker: "B", text: "Hello dear." }, { speaker: "A", text: "We got a puppy named Max!" }], selfIntroductions: [] },
      }),
    });
    const { visitId } = (await recordRecognition(p.id, d.deviceId, { personId: priya.id, confidence: 0.9, source: "face" })).card!;
    const s = await call(start, { cookie: d.cookie, body: { visitId } });
    expect(s.status).toBe(201);
    const cid = s.body.conversationId;
    expect((await call(start, { cookie: d.cookie, body: {} })).body.conversationId).toBe(cid); // the existing recording one

    expect((await send(d.cookie, cid, 1, wavOf(2))).body).toMatchObject({ seq: 1, status: "done", textPreview: "B: Hello dear.\nA: We got a puppy named Max!" });
    expect((await send(d.cookie, cid, 0, wavOf(1))).body.status).toBe("done");

    const f = await call(finish, { method: "POST", cookie: d.cookie, params: { cid } });
    expect(f.body).toMatchObject({ status: "done", speakerClaim: { claimedName: "Priya", matchesFace: true } });
    expect(f.body.summary).toMatch(/Priya/);

    const full = await call(getConvo, { cookie: a.cookie, params: { cid } });
    expect(full.body.transcript).toBe("A: Hi Mom, it's Priya.\nB: Hello dear.\nA: We got a puppy named Max!");
    expect(full.body.conversation.personName).toBe("Priya");
    const l = await call(listConvos, { cookie: a.cookie, params: { pid: p.id }, path: `/x?personId=${priya.id}` });
    expect(l.body.conversations).toHaveLength(1);

    // The next recognition card's recap now carries the conversation.
    const next = await recordRecognition(p.id, d.deviceId, { personId: priya.id, confidence: 0.9, source: "face" }, new Date(Date.now() + 3600_000));
    expect(next.card!.recap).toContain("Priya came to visit.");
    // Chunk after finish → 409
    expect((await send(d.cookie, cid, 2)).status).toBe(409);
  });

  it("a failed chunk doesn't fail the conversation", async () => {
    const { d, priya } = await world();
    setAiOverrides({
      transcriber: scripted({
        10: { segments: [{ speaker: "A", text: "Lovely weather." }], selfIntroductions: [] },
        20: new Error("gemini down"),
      }),
    });
    const cid = (await call(start, { cookie: d.cookie, body: { personId: priya.id } })).body.conversationId;
    expect((await send(d.cookie, cid, 0, wavOf(1))).status).toBe(200);
    const bad = await send(d.cookie, cid, 1, wavOf(2));
    expect(bad.status).toBe(503);
    const f = await call(finish, { method: "POST", cookie: d.cookie, params: { cid } });
    expect(f.body.status).toBe("done");
    expect(f.body.summary).toBeTruthy();
  });

  it("all chunks failing marks the conversation failed", async () => {
    const { d } = await world();
    setAiOverrides({ transcriber: scripted({ 10: new Error("down") }) });
    const cid = (await call(start, { cookie: d.cookie, body: {} })).body.conversationId;
    await send(d.cookie, cid, 0, wavOf(1));
    expect((await call(finish, { method: "POST", cookie: d.cookie, params: { cid } })).body.status).toBe("failed");
  });

  it("a mismatched self-introduction records matchesFace=false (caregiver flag)", async () => {
    const { p, d, priya } = await world();
    setAiOverrides({
      transcriber: scripted({ 10: { segments: [{ speaker: "A", text: "Hi, it's Sam from next door." }], selfIntroductions: [{ name: "Sam", quote: "it's Sam" }] } }),
    });
    const { visitId } = (await recordRecognition(p.id, d.deviceId, { personId: priya.id, confidence: 0.9, source: "face" })).card!;
    const cid = (await call(start, { cookie: d.cookie, body: { visitId } })).body.conversationId;
    await send(d.cookie, cid, 0, wavOf(1));
    const f = await call(finish, { method: "POST", cookie: d.cookie, params: { cid } });
    expect(f.body.speakerClaim).toMatchObject({ claimedName: "Sam", matchesFace: false, faceName: "Priya" });
  });

  it("with no face, a claim matching an approved person writes a voice recognition", async () => {
    const { p, d, sam } = await world();
    setAiOverrides({
      transcriber: scripted({ 10: { segments: [{ speaker: "A", text: "Hello Margaret, it's Sam." }], selfIntroductions: [{ name: "Sam", quote: "it's Sam" }] } }),
    });
    const cid = (await call(start, { cookie: d.cookie, body: {} })).body.conversationId;
    await send(d.cookie, cid, 0, wavOf(1));
    const f = await call(finish, { method: "POST", cookie: d.cookie, params: { cid } });
    expect(f.body.mightBe).toEqual({ personId: sam.id, name: "Sam" });
    const rec = await db().select().from(recognitionEvents).where(eq(recognitionEvents.patientId, p.id));
    expect(rec).toEqual([expect.objectContaining({ personId: sam.id, source: "voice", confidence: 0.5 })]);
  });

  it("validates chunk uploads (non-WAV 400, too large 413) and scopes devices", async () => {
    const { a, d } = await world();
    const cid = (await call(start, { cookie: d.cookie, body: {} })).body.conversationId;
    expect((await send(d.cookie, cid, 0, Buffer.from("not audio at all, definitely not"))).status).toBe(400);
    const big = await call(chunk, { method: "POST", cookie: d.cookie, params: { cid }, path: "/x?seq=0", rawBody: new Uint8Array(4 * 1024 * 1024 + 10) });
    expect(big.status).toBe(413);
    const other = await makePatient(a.caregiver.id);
    const od = await makeDevice(other.id, a.caregiver.id);
    expect((await send(od.cookie, cid, 0)).status).toBe(404);
  });
});
