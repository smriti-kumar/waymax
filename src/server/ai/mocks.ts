import "server-only";
import type { TextToSpeech } from "./interfaces";

/** Deterministic fake TTS: a tiny "mp3" whose bytes encode the text. Counts calls. */
export class MockTTS implements TextToSpeech {
  readonly provider = "mock";
  readonly model = "mock-tts";
  readonly voice = "mock-voice";
  calls = 0;
  async synthesize(text: string) {
    this.calls++;
    return Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 0x04]), Buffer.from(text.padEnd(200, " "))]);
  }
}

import type {
  InsightInput,
  InsightWriter,
  NarrationInput,
  Narrator,
  SummaryInput,
  SummaryOutput,
  Summarizer,
  Transcriber,
  Transcription,
} from "./interfaces";
import type { NarrationScript } from "@/server/db/schema";

/** Deterministic transcript: one line per chunk, describing its length. */
export class MockTranscriber implements Transcriber {
  calls = 0;
  constructor(private script?: (wav: Buffer, call: number) => Transcription | Promise<Transcription>) {}
  async transcribe(wav: Buffer): Promise<Transcription> {
    this.calls++;
    if (this.script) return this.script(wav, this.calls);
    // 16 kHz mono PCM16 → 32000 bytes per second after the 44-byte header.
    const seconds = Math.max(0, Math.round((wav.length - 44) / 32000));
    return {
      segments: [{ speaker: "A", text: `It was lovely to see you today. We talked for about ${seconds} seconds.` }],
      selfIntroductions: [],
    };
  }
}

export class MockSummarizer implements Summarizer {
  async summarize(input: SummaryInput): Promise<SummaryOutput> {
    const who = input.personName ?? "a visitor";
    return {
      summary: `You had a nice chat with ${who}. You talked about your day.`,
      keyFacts: input.transcript.trim() ? [`${who} came to visit`] : [],
    };
  }
}

/** Captions = memory titles, as in the §5.6 fallback. */
export class MockNarrator implements Narrator {
  async narrate(input: NarrationInput): Promise<NarrationScript> {
    return {
      intro: `Here are some memories with ${input.name}, your ${input.relationship}.`,
      slides: input.memories.map((m) => ({ memoryId: m.id, caption: m.title })),
      outro: `${input.name} loves you very much.`,
    };
  }
}

export class MockInsightWriter implements InsightWriter {
  async insight(input: InsightInput): Promise<string | null> {
    const total = input.daily.reduce((s, d) => s + d.n, 0);
    if (!total) return null;
    const peak = [...input.byHour].sort((a, b) => b.n - a.n)[0];
    if (!peak || !peak.n) return null;
    const part = peak.hour < 12 ? "morning" : peak.hour < 17 ? "afternoon" : "evening";
    return `Presses were highest in the ${part} over the last two weeks.`;
  }
}
