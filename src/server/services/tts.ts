import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { ttsCache } from "@/server/db/schema";
import { env } from "@/server/env";
import { tts } from "@/server/ai";
import { storage } from "@/server/storage";

export const TTS_TIMEOUT_MS = 8000;

export function ttsKey(provider: string, model: string, voice: string, text: string) {
  return createHash("sha256").update(`${provider}|${model}|${voice}|${text}`).digest("hex");
}

/** Normalize so "Priya, your daughter." and "Priya,  your daughter. " share a cache entry. */
export function normalizeSpeech(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export type SpeechResult =
  | { kind: "audio"; bytes: Buffer; cached: boolean }
  | { kind: "fallback"; reason: "mock" | "budget" | "error" | "timeout" };

function monthStartUtc(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function charsUsedThisMonth(provider: string, now = new Date()) {
  const [row] = await db()
    .select({ n: sql<number>`coalesce(sum(length(${ttsCache.text})), 0)::int` })
    .from(ttsCache)
    .where(and(eq(ttsCache.provider, provider), gte(ttsCache.createdAt, monthStartUtc(now))));
  return Number(row?.n ?? 0);
}

/** Cache hit → stored clip. Miss → budget check → provider (8 s) → store. Any failure → fallback. */
export async function speech(rawText: string, patientId: string, opts: { timeoutMs?: number } = {}): Promise<SpeechResult> {
  const text = normalizeSpeech(rawText);
  const provider = tts();
  if (!provider) return { kind: "fallback", reason: "mock" };
  const key = ttsKey(provider.provider, provider.model, provider.voice, text);
  try {
    const [hit] = await db().select().from(ttsCache).where(eq(ttsCache.key, key));
    if (hit) {
      const media = await storage().get(hit.mediaId);
      if (media) return { kind: "audio", bytes: media.bytes, cached: true };
    }
    const used = await charsUsedThisMonth(provider.provider);
    if (used + text.length > env().TTS_MONTHLY_CHAR_BUDGET) {
      console.warn(`[tts] monthly budget reached (${used} chars); using browser voice`);
      return { kind: "fallback", reason: "budget" };
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? TTS_TIMEOUT_MS);
    const started = Date.now();
    let bytes: Buffer;
    try {
      bytes = await provider.synthesize(text, ac.signal);
    } finally {
      clearTimeout(timer);
    }
    console.log(`[tts] ${provider.provider} ${provider.model} ${text.length} chars ${Date.now() - started}ms`);
    const { id } = await storage().put({ patientId, mime: "audio/mpeg", bytes });
    await db()
      .insert(ttsCache)
      .values({ key, text, provider: provider.provider, mediaId: id })
      .onConflictDoNothing();
    return { kind: "audio", bytes, cached: false };
  } catch (err) {
    const timeout = (err as Error).name === "AbortError";
    console.warn(`[tts] ${timeout ? "timeout" : "error"}: ${(err as Error).message}`);
    return { kind: "fallback", reason: timeout ? "timeout" : "error" };
  }
}
