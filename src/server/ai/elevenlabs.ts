import "server-only";
import type { TextToSpeech, Transcriber, Transcription } from "./interfaces";
import { extractSelfIntroductions } from "@/lib/intros";

/** ElevenLabs REST TTS (no SDK): POST /v1/text-to-speech/{voice_id}, mp3_44100_64. */
export class ElevenLabsTTS implements TextToSpeech {
  readonly provider = "elevenlabs";

  constructor(
    private apiKey: string,
    readonly voice: string,
    readonly model: string,
    private baseUrl = "https://api.elevenlabs.io",
  ) {}

  async synthesize(text: string, signal?: AbortSignal): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/v1/text-to-speech/${encodeURIComponent(this.voice)}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": this.apiKey, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: this.model,
        voice_settings: { stability: 0.6, similarity_boost: 0.75, speed: 0.9 },
      }),
      signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`ElevenLabs HTTP ${res.status}: ${detail}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) throw new Error("ElevenLabs returned an empty clip");
    return buf;
  }
}


type ScribeWord = { text: string; type: "word" | "spacing" | "audio_event"; speaker_id?: string };

/** Groups Scribe's word list into speaker turns, labelling speakers A, B, C in order of first speaking. */
export function scribeToSegments(words: ScribeWord[]) {
  const labels = new Map<string, string>();
  const segments: { speaker: string; text: string }[] = [];
  for (const w of words) {
    if (w.type === "audio_event") continue;
    const id = w.speaker_id ?? "speaker_0";
    if (!labels.has(id)) labels.set(id, String.fromCharCode(65 + Math.min(labels.size, 25)));
    const speaker = labels.get(id)!;
    const last = segments.at(-1);
    if (last && last.speaker === speaker) last.text += w.text;
    else if (w.type === "word") segments.push({ speaker, text: w.text });
  }
  return segments.map((s) => ({ ...s, text: s.text.replace(/\s+/g, " ").trim() })).filter((s) => s.text);
}

/** ElevenLabs Scribe speech-to-text with speaker diarization (POST /v1/speech-to-text). */
export class ElevenLabsTranscriber implements Transcriber {
  constructor(
    private apiKey: string,
    private model = "scribe_v1",
    private timeoutMs = 45_000,
    private baseUrl = "https://api.elevenlabs.io",
  ) {}

  async transcribe(wav: Buffer): Promise<Transcription> {
    const fd = new FormData();
    fd.append("model_id", this.model);
    fd.append("diarize", "true");
    fd.append("tag_audio_events", "false");
    fd.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "chunk.wav");
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    const started = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/v1/speech-to-text`, {
        method: "POST",
        headers: { "xi-api-key": this.apiKey },
        body: fd,
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(`ElevenLabs STT HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
      const data = (await res.json()) as { text?: string; words?: ScribeWord[] };
      const segments = data.words?.length ? scribeToSegments(data.words) : data.text ? [{ speaker: "A", text: data.text.trim() }] : [];
      const selfIntroductions = segments.flatMap((s) => extractSelfIntroductions(s.text));
      console.log(`[stt] elevenlabs ${this.model} ${Date.now() - started}ms ok (${segments.length} turns)`);
      return { segments, selfIntroductions };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Tries each transcriber in order (e.g. ElevenLabs Scribe, then Gemini). */
export class FallbackTranscriber implements Transcriber {
  constructor(private chain: Transcriber[]) {}
  async transcribe(wav: Buffer): Promise<Transcription> {
    let last: unknown;
    for (const t of this.chain) {
      try {
        return await t.transcribe(wav);
      } catch (err) {
        last = err;
        console.warn(`[stt] ${t.constructor.name} failed: ${(err as Error).message}`);
      }
    }
    throw last instanceof Error ? last : new Error("all transcribers failed");
  }
}
