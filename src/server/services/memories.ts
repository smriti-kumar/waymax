import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { conversations, people, personMemories, type NarrationScript } from "@/server/db/schema";
import { notFound } from "@/server/http/errors";
import { narrator } from "@/server/ai";
import { env } from "@/server/env";
import type { NarrationInput } from "@/server/ai/interfaces";
import { mediaUrl } from "@/server/storage";

export type Slide = { memoryId: string; title: string; caption: string; photoUrl: string | null };
export type Slideshow = { personId: string; name: string; relationship: string; intro: string; slides: Slide[]; outro: string };

/** Which narrator would run — part of the cache key so mock captions never outlive real keys. */
function narratorId() {
  const e = env();
  return e.geminiMode === "live" ? `gemini:${e.GEMINI_MODEL}` : "mock";
}

export function narrationHash(input: NarrationInput, who = narratorId()) {
  return createHash("sha256").update(JSON.stringify({ who, input })).digest("hex");
}

/** Keep only slides for real memory ids (in input order), filling gaps with the title. */
export function cleanNarration(script: NarrationScript, input: NarrationInput): NarrationScript {
  const byId = new Map(script.slides.map((s) => [s.memoryId, s.caption.trim()]));
  return {
    intro: script.intro.trim(),
    outro: script.outro.trim(),
    slides: input.memories.map((m) => ({ memoryId: m.id, caption: byId.get(m.id) || m.title })),
  };
}

export function fallbackNarration(input: NarrationInput): NarrationScript {
  return {
    intro: `Here are some memories with ${input.name}, your ${input.relationship}.`,
    slides: input.memories.map((m) => ({ memoryId: m.id, caption: m.title })),
    outro: "",
  };
}

export async function buildSlideshow(patientId: string, personId: string): Promise<Slideshow> {
  const [p] = await db()
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.patientId, patientId), eq(people.status, "approved")));
  if (!p) throw notFound("Person not found");
  const mems = await db()
    .select()
    .from(personMemories)
    .where(eq(personMemories.personId, personId))
    .orderBy(sql`${personMemories.occurredOn} desc nulls last`, desc(personMemories.createdAt))
    .limit(30);
  const facts = await db()
    .select({ keyFacts: conversations.keyFacts })
    .from(conversations)
    .where(and(eq(conversations.personId, personId), eq(conversations.status, "done"), isNotNull(conversations.summary)))
    .orderBy(desc(conversations.startedAt))
    .limit(5);
  const input: NarrationInput = {
    name: p.name!,
    relationship: p.relationship!,
    description: p.description,
    routine: p.visitRoutine,
    memories: mems.map((m) => ({ id: m.id, title: m.title, body: m.body, occurredOn: m.occurredOn })),
    keyFacts: facts.flatMap((f) => f.keyFacts).slice(0, 10),
  };

  let script: NarrationScript;
  const hash = narrationHash(input);
  if (p.narration && p.narrationHash === hash) {
    script = p.narration;
  } else if (!input.memories.length) {
    script = fallbackNarration(input);
  } else {
    try {
      script = cleanNarration(await narrator().narrate(input), input);
      await db().update(people).set({ narration: script, narrationHash: hash }).where(eq(people.id, p.id));
    } catch (err) {
      console.warn("[memories] narration failed, using titles", (err as Error).message);
      script = fallbackNarration(input);
    }
  }

  const memById = new Map(mems.map((m) => [m.id, m]));
  const primary = mediaUrl(p.primaryPhotoId);
  let slides: Slide[] = script.slides.map((s) => {
    const m = memById.get(s.memoryId)!;
    return { memoryId: s.memoryId, title: m.title, caption: s.caption, photoUrl: mediaUrl(m.mediaId) ?? primary };
  });
  if (!slides.length) {
    // No memories yet: one slide with their photo (or initials on the client).
    slides = [{ memoryId: "person", title: p.name!, caption: `${p.name}, your ${p.relationship}.`, photoUrl: primary }];
  }
  return { personId: p.id, name: p.name!, relationship: p.relationship!, intro: script.intro, slides, outro: script.outro };
}
