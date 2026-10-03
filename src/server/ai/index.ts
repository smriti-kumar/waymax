import "server-only";
import { env } from "@/server/env";
import { ElevenLabsTTS } from "./elevenlabs";
import type { TextToSpeech } from "./interfaces";

type Overrides = { tts?: TextToSpeech | null };
const overrides: Overrides = {};

/** Tests only: force a provider (null = mock/fallback). */
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
