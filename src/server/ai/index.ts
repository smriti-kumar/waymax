import "server-only";
import { env } from "@/server/env";
import { ElevenLabsTranscriber, ElevenLabsTTS, FallbackTranscriber } from "./elevenlabs";
import { GeminiClient, GeminiInsightWriter, GeminiNarrator, GeminiSummarizer, GeminiTranscriber } from "./gemini";
import type { InsightWriter, Narrator, Summarizer, TextToSpeech, Transcriber } from "./interfaces";
import { MockInsightWriter, MockNarrator, MockSummarizer, MockTranscriber } from "./mocks";

type Overrides = {
  tts?: TextToSpeech | null;
  transcriber?: Transcriber;
  summarizer?: Summarizer;
  narrator?: Narrator;
  insight?: InsightWriter;
};
const overrides: Overrides = {};

/** Tests only: force a provider (tts: null = mock/fallback). */
export function setAiOverrides(o: Overrides) {
  Object.assign(overrides, o);
}
export function clearAiOverrides() {
  for (const k of Object.keys(overrides)) delete overrides[k as keyof Overrides];
}

/** Live ElevenLabs, or null in mock mode (the client then speaks with the browser voice). */
export function tts(): TextToSpeech | null {
  if ("tts" in overrides) return overrides.tts ?? null;
  const e = env();
  if (e.ttsMode !== "live") return null;
  return new ElevenLabsTTS(e.ELEVENLABS_API_KEY!, e.ELEVENLABS_VOICE_ID!, e.ELEVENLABS_MODEL_ID);
}

function gemini(): GeminiClient | null {
  const e = env();
  if (e.geminiMode !== "live") return null;
  return new GeminiClient(e.GEMINI_API_KEY!, e.GEMINI_MODEL, e.GEMINI_FALLBACK_MODEL);
}

/** ElevenLabs Scribe first (better at real-room speech), Gemini as backup; mock without keys. */
export function transcriber(): Transcriber {
  if (overrides.transcriber) return overrides.transcriber;
  const e = env();
  const chain: Transcriber[] = [];
  if (!e.AI_MOCK && e.ELEVENLABS_API_KEY) chain.push(new ElevenLabsTranscriber(e.ELEVENLABS_API_KEY, e.ELEVENLABS_STT_MODEL));
  const g = gemini();
  if (g) chain.push(new GeminiTranscriber(g));
  if (!chain.length) return new MockTranscriber();
  return chain.length === 1 ? chain[0]! : new FallbackTranscriber(chain);
}

export function summarizer(): Summarizer {
  if (overrides.summarizer) return overrides.summarizer;
  const g = gemini();
  return g ? new GeminiSummarizer(g) : new MockSummarizer();
}

export function narrator(): Narrator {
  if (overrides.narrator) return overrides.narrator;
  const g = gemini();
  return g ? new GeminiNarrator(g) : new MockNarrator();
}

export function insightWriter(): InsightWriter {
  if (overrides.insight) return overrides.insight;
  const g = gemini();
  return g ? new GeminiInsightWriter(g) : new MockInsightWriter();
}
