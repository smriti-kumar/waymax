import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { setupFetchServer } from "../support/msw";
import { GeminiClient, GeminiError, GeminiSummarizer, GeminiTranscriber } from "@/server/ai/gemini";
import { wavOf } from "../support/wav";

const server = setupFetchServer();
beforeAll(() => server.listen());
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

const URL_RE = "https://generativelanguage.googleapis.com/:version/models/:model";
const reply = (text: string) =>
  HttpResponse.json({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP", index: 0 }] });
const good = JSON.stringify({ segments: [{ speaker: "A", text: "Hi Mom, it's Priya." }], selfIntroductions: [{ name: "Priya", quote: "it's Priya" }] });

function handler(byModel: Record<string, () => Response | Promise<Response>>, seen: string[]) {
  return http.post(URL_RE, async ({ params, request }) => {
    const model = String(params.model).replace(/:generateContent$/, "");
    seen.push(model);
    if (seen.length === 1) {
      const body = (await request.json()) as any;
      expect(body.generationConfig.responseMimeType).toBe("application/json");
      const first = body.contents[0].parts[0];
      if (first.inlineData) expect(first.inlineData.mimeType).toBe("audio/wav");
    }
    return byModel[model]!();
  });
}

describe("Gemini plumbing", () => {
  const client = (timeoutMs = 2000) => new GeminiClient("test-key", "gemini-3-flash-preview", "gemini-3.1-flash-lite", timeoutMs);

  it("parses valid JSON from the primary model", async () => {
    const seen: string[] = [];
    server.use(handler({ "gemini-3-flash-preview": () => reply(good) }, seen));
    const t = await new GeminiTranscriber(client()).transcribe(wavOf(1));
    expect(t.selfIntroductions[0].name).toBe("Priya");
    expect(seen).toEqual(["gemini-3-flash-preview"]);
  });

  for (const [name, bad] of [
    ["429", () => HttpResponse.json({ error: { code: 429, message: "quota", status: "RESOURCE_EXHAUSTED" } }, { status: 429 })],
    ["invalid JSON", () => reply("this is not json")],
    ["schema mismatch", () => reply(JSON.stringify({ segments: "nope" }))],
  ] as const) {
    it(`${name} on the primary → retries once on the fallback model`, async () => {
      const seen: string[] = [];
      server.use(handler({ "gemini-3-flash-preview": bad, "gemini-3.1-flash-lite": () => reply(good) }, seen));
      const t = await new GeminiTranscriber(client()).transcribe(wavOf(1));
      expect(t.segments).toHaveLength(1);
      expect(seen).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite"]);
    });
  }

  it("timeout on both models → GeminiError after exactly two attempts", async () => {
    const seen: string[] = [];
    const slow = async () => {
      await delay(1500);
      return reply(good);
    };
    server.use(handler({ "gemini-3-flash-preview": slow, "gemini-3.1-flash-lite": slow }, seen));
    const err = await new GeminiSummarizer(client(200))
      .summarize({ transcript: "A: hi", personName: "Priya", relationship: "daughter", patientName: "Maggie" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(GeminiError);
    expect(err.attempts.map((a: any) => a.error)).toEqual(["timeout after 200ms", "timeout after 200ms"]);
  });
});
