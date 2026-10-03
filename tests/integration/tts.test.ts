import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { setupFetchServer } from "../support/msw";
import { describeDb, truncateAll } from "../support/db";
import { call } from "../support/http";
import { makeCaregiver, makeDevice, makePatient } from "../support/factories";
import { clearAiOverrides, setAiOverrides } from "@/server/ai";
import { ElevenLabsTTS } from "@/server/ai/elevenlabs";
import { MockTTS } from "@/server/ai/mocks";
import { speech, ttsKey } from "@/server/services/tts";
import { resetEnvCache } from "@/server/env";
import { POST as ttsRoute } from "@/app/api/tts/route";

const server = setupFetchServer();
beforeAll(() => server.listen());
afterAll(() => server.close());
afterEach(() => {
  server.resetHandlers();
  clearAiOverrides();
  delete process.env.TTS_MONTHLY_CHAR_BUDGET;
  resetEnvCache();
});

const EL = "https://api.elevenlabs.io/v1/text-to-speech/:voice";

describeDb("text to speech", () => {
  beforeEach(truncateAll);

  it("caches by provider|model|voice|text: a hit doesn't call the provider", async () => {
    const p = await makePatient();
    const fake = new MockTTS();
    setAiOverrides({ tts: fake });
    const a = await speech("Priya, your daughter.", p.id);
    const b = await speech("Priya,  your daughter. ", p.id);
    expect(a.kind).toBe("audio");
    expect(b).toMatchObject({ kind: "audio", cached: true });
    expect(fake.calls).toBe(1);
    expect(ttsKey("mock", "mock-tts", "mock-voice", "x")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns fallback when the monthly character budget would be exceeded", async () => {
    process.env.TTS_MONTHLY_CHAR_BUDGET = "30";
    resetEnvCache();
    const p = await makePatient();
    const fake = new MockTTS();
    setAiOverrides({ tts: fake });
    expect((await speech("Twenty characters ok", p.id)).kind).toBe("audio");
    expect(await speech("This one pushes us over", p.id)).toEqual({ kind: "fallback", reason: "budget" });
    expect(fake.calls).toBe(1);
  });

  it("returns fallback on ElevenLabs 401 and 429 (MSW)", async () => {
    const p = await makePatient();
    setAiOverrides({ tts: new ElevenLabsTTS("bad-key", "voice123", "eleven_flash_v2_5") });
    server.use(http.post(EL, () => HttpResponse.json({ detail: "invalid key" }, { status: 401 })));
    expect(await speech("Hello", p.id)).toEqual({ kind: "fallback", reason: "error" });
    server.use(http.post(EL, () => HttpResponse.json({ detail: "busy" }, { status: 429 })));
    expect(await speech("Hello again", p.id)).toEqual({ kind: "fallback", reason: "error" });
  });

  it("returns fallback when ElevenLabs is too slow", async () => {
    const p = await makePatient();
    setAiOverrides({ tts: new ElevenLabsTTS("k", "voice123", "eleven_flash_v2_5") });
    server.use(
      http.post(EL, async () => {
        await delay(2000);
        return new HttpResponse(new Uint8Array(500), { headers: { "content-type": "audio/mpeg" } });
      }),
    );
    expect(await speech("Slow", p.id, { timeoutMs: 200 })).toEqual({ kind: "fallback", reason: "timeout" });
  });

  it("stores and replays a real ElevenLabs response, sending the right request", async () => {
    const p = await makePatient();
    setAiOverrides({ tts: new ElevenLabsTTS("key-1", "voice123", "eleven_flash_v2_5") });
    let seen: { voice?: string; key?: string | null; body?: any; fmt?: string | null } = {};
    server.use(
      http.post(EL, async ({ request, params }) => {
        seen = {
          voice: params.voice as string,
          key: request.headers.get("xi-api-key"),
          body: await request.json(),
          fmt: new URL(request.url).searchParams.get("output_format"),
        };
        return new HttpResponse(new Uint8Array(800).fill(7), { headers: { "content-type": "audio/mpeg" } });
      }),
    );
    const r = await speech("Raj, your son.", p.id);
    expect(r).toMatchObject({ kind: "audio", cached: false });
    expect(seen).toMatchObject({ voice: "voice123", key: "key-1", fmt: "mp3_44100_64", body: { text: "Raj, your son.", model_id: "eleven_flash_v2_5" } });
  });

  it("the route never errors: mock mode returns {fallback: true}", async () => {
    const a = await makeCaregiver();
    const p = await makePatient(a.caregiver.id);
    const d = await makeDevice(p.id, a.caregiver.id);
    const r = await call(ttsRoute, { cookie: d.cookie, body: { text: "Hello Maggie" } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ fallback: true, text: "Hello Maggie", reason: "mock" });
    setAiOverrides({ tts: new MockTTS() });
    const audio = await call(ttsRoute, { cookie: a.cookie, body: { text: "Preview" } });
    expect(audio.headers.get("content-type")).toBe("audio/mpeg");
    expect((await call(ttsRoute, { body: { text: "x" } })).status).toBe(401);
  });
});
