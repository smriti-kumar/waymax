import "server-only";
import type { TextToSpeech } from "./interfaces";

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
