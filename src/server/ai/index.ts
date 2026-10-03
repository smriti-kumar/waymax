import "server-only";
import { env } from "@/server/env";
import { ElevenLabsTTS } from "./elevenlabs";
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

export function transcriber(): Transcriber {
  if (overrides.transcriber) return overrides.transcriber;
  const g = gemini();
  return g ? new GeminiTranscriber(g) : new MockTranscriber();
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
