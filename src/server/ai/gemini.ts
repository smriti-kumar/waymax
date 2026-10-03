import "server-only";
import { GoogleGenAI, Type, type Part, type Schema } from "@google/genai";
import { z, type ZodType } from "zod";
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

export const GEMINI_TIMEOUT_MS = 20_000;

export class GeminiError extends Error {
  constructor(
    message: string,
    public attempts: { model: string; error: string }[],
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

/**
 * Shared plumbing (PLAN §5.10): JSON mode + responseSchema, 20 s timeout, no SDK
 * retries, zod validation, then exactly one retry on the fallback model. One log
 * line per attempt with model, latency and outcome.
 */
export class GeminiClient {
  private ai: GoogleGenAI;
  constructor(
    apiKey: string,
    readonly model: string,
    readonly fallbackModel: string,
    private timeoutMs = GEMINI_TIMEOUT_MS,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async json<T>(label: string, parts: Part[], responseSchema: Schema, validate: ZodType<T>): Promise<T> {
    const attempts: { model: string; error: string }[] = [];
    for (const model of [this.model, this.fallbackModel]) {
      const started = Date.now();
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), this.timeoutMs);
      try {
        const res = await this.ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.2,
            abortSignal: ac.signal,
            httpOptions: { timeout: this.timeoutMs, retryOptions: { attempts: 1 } },
          },
        });
        const text = res.text ?? "";
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          throw new Error(`invalid JSON: ${text.slice(0, 80)}`);
        }
        const parsed = validate.safeParse(raw);
        if (!parsed.success) throw new Error(`schema mismatch: ${parsed.error.issues[0]?.message ?? "invalid"}`);
        console.log(`[gemini] ${label} model=${model} ${Date.now() - started}ms ok`);
        return parsed.data;
      } catch (err) {
        const msg = ac.signal.aborted ? `timeout after ${this.timeoutMs}ms` : (err as Error).message.slice(0, 200);
        attempts.push({ model, error: msg });
        console.warn(`[gemini] ${label} model=${model} ${Date.now() - started}ms failed: ${msg}`);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new GeminiError(`${label} failed on both models`, attempts);
  }
}

// ---------- transcription (§5.2) ----------

export const transcriptionSchema = z.object({
  segments: z.array(z.object({ speaker: z.string().max(10), text: z.string() })),
  selfIntroductions: z.array(z.object({ name: z.string().min(1).max(60), quote: z.string() })),
});

const transcriptionResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { speaker: { type: Type.STRING }, text: { type: Type.STRING } },
        required: ["speaker", "text"],
      },
    },
    selfIntroductions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING }, quote: { type: Type.STRING } },
        required: ["name", "quote"],
      },
    },
  },
  required: ["segments", "selfIntroductions"],
};

export const TRANSCRIBE_PROMPT =
  "Transcribe this conversation. Label distinct speakers A, B, C in order of first speaking. List any name a speaker uses to introduce themselves or that someone addresses them by. Return only JSON matching the schema. If audio is silent, return empty arrays.";

export class GeminiTranscriber implements Transcriber {
  constructor(private client: GeminiClient) {}
  transcribe(wav: Buffer): Promise<Transcription> {
    return this.client.json(
      "transcribe",
      [{ inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } }, { text: TRANSCRIBE_PROMPT }],
      transcriptionResponseSchema,
      transcriptionSchema,
    );
  }
}

// ---------- summary (§5.3) ----------

export const summarySchema = z.object({
  summary: z.string().min(1).max(600),
  keyFacts: z.array(z.string().min(1).max(160)).max(5),
});

const summaryResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: { summary: { type: Type.STRING }, keyFacts: { type: Type.ARRAY, items: { type: Type.STRING } } },
  required: ["summary", "keyFacts"],
};

export const SUMMARY_PROMPT =
  "You help a person with memory loss remember a visit. Write a warm, simple summary in second person ('You talked with Priya about…'). Use short sentences. Do not mention illness, memory problems, or anything upsetting. Then list up to 5 concrete facts worth remembering next time.";

export class GeminiSummarizer implements Summarizer {
  constructor(private client: GeminiClient) {}
  summarize(input: SummaryInput): Promise<SummaryOutput> {
    const who = input.personName
      ? `${input.personName}${input.relationship ? `, their ${input.relationship}` : ""}`
      : "a visitor";
    const text = [
      SUMMARY_PROMPT,
      `The person you are writing to is ${input.patientName}. They talked with ${who}.`,
      "The summary is at most 2 sentences. Key facts are short, concrete and never medical.",
      "Transcript:",
      input.transcript.slice(0, 30_000),
    ].join("\n\n");
    return this.client.json("summarize", [{ text }], summaryResponseSchema, summarySchema);
  }
}

// ---------- memories narration (§5.6) ----------

export const narrationSchema = z.object({
  intro: z.string().min(1).max(400),
  slides: z.array(z.object({ memoryId: z.string(), caption: z.string().min(1).max(200) })),
  outro: z.string().min(1).max(400),
});

const narrationResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    intro: { type: Type.STRING },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { memoryId: { type: Type.STRING }, caption: { type: Type.STRING } },
        required: ["memoryId", "caption"],
      },
    },
    outro: { type: Type.STRING },
  },
  required: ["intro", "slides", "outro"],
};

export class GeminiNarrator implements Narrator {
  constructor(private client: GeminiClient) {}
  narrate(input: NarrationInput): Promise<NarrationScript> {
    const text = [
      "You narrate a gentle photo slideshow for a person with memory loss. Speak to them in second person, warmly and simply.",
      "Write a one-sentence intro, one caption of at most 20 words per memory (use the memory's id as memoryId, keep the given order), and a one-sentence outro.",
      "Never mention illness, memory problems, or anything upsetting. Use only the facts given.",
      `Person: ${input.name}, their ${input.relationship}.`,
      input.description ? `About them: ${input.description}` : "",
      input.routine ? `Routine: ${input.routine}` : "",
      input.keyFacts.length ? `Recent things to remember: ${input.keyFacts.join("; ")}` : "",
      "Memories (JSON):",
      JSON.stringify(input.memories),
    ]
      .filter(Boolean)
      .join("\n");
    return this.client.json("narrate", [{ text }], narrationResponseSchema, narrationSchema);
  }
}

// ---------- confusion insight (§5.7) ----------

export const insightSchema = z.object({ insight: z.string().max(240) });
const insightResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: { insight: { type: Type.STRING } },
  required: ["insight"],
};

export class GeminiInsightWriter implements InsightWriter {
  constructor(private client: GeminiClient) {}
  async insight(input: InsightInput): Promise<string | null> {
    const text = [
      "You write one neutral sentence for a family caregiver describing when 'I feel confused' button presses happened.",
      "Describe the pattern only, e.g. 'Presses were highest in late afternoon this week.' No advice, no medical or diagnostic words, no speculation about causes.",
      "If there were no presses, say so plainly.",
      `Daily counts (last 14 days): ${JSON.stringify(input.daily)}`,
      `By hour of day (patient local time): ${JSON.stringify(input.byHour)}`,
    ].join("\n");
    const r = await this.client.json("insight", [{ text }], insightResponseSchema, insightSchema);
    return r.insight.trim() || null;
  }
}
