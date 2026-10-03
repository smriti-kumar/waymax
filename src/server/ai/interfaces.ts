// Every external AI call goes through one of these interfaces (PLAN §5.10).
import type { NarrationScript } from "@/server/db/schema";

export interface TextToSpeech {
  readonly provider: string;
  readonly model: string;
  readonly voice: string;
  /** mp3 bytes, or throws. */
  synthesize(text: string, signal?: AbortSignal): Promise<Buffer>;
}

export type TranscriptSegment = { speaker: string; text: string };
export type SelfIntroduction = { name: string; quote: string };
export type Transcription = { segments: TranscriptSegment[]; selfIntroductions: SelfIntroduction[] };

export interface Transcriber {
  transcribe(wav: Buffer): Promise<Transcription>;
}

export type SummaryInput = { transcript: string; personName: string | null; relationship: string | null; patientName: string };
export type SummaryOutput = { summary: string; keyFacts: string[] };

export interface Summarizer {
  summarize(input: SummaryInput): Promise<SummaryOutput>;
}

export type NarrationInput = {
  name: string;
  relationship: string;
  description: string | null;
  routine: string | null;
  memories: { id: string; title: string; body: string | null; occurredOn: string | null }[];
  keyFacts: string[];
};

export interface Narrator {
  narrate(input: NarrationInput): Promise<NarrationScript>;
}

export type InsightInput = { daily: { day: string; n: number }[]; byHour: { hour: number; n: number }[] };

export interface InsightWriter {
  insight(input: InsightInput): Promise<string | null>;
}
