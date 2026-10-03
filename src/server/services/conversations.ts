import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { conversationChunks, conversations, people, recognitionEvents, visits, type SpeakerClaim } from "@/server/db/schema";
import { conflict, notFound, unprocessable, upstream } from "@/server/http/errors";
import { isUuid } from "@/server/auth/guards";
import { summarizer, transcriber } from "@/server/ai";
import type { Transcription } from "@/server/ai/interfaces";
import { transcriptionSchema } from "@/server/ai/gemini";
import { getPatient } from "./patients";
import { NameClaimSpeakerIdentifier, type SpeakerIdentifier } from "./speaker";

export const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
const identifier: SpeakerIdentifier = new NameClaimSpeakerIdentifier();

export type ConversationRow = typeof conversations.$inferSelect;

export async function getConversation(cid: string) {
  if (!isUuid(cid)) throw notFound("Conversation not found");
  const [c] = await db().select().from(conversations).where(eq(conversations.id, cid));
  if (!c) throw notFound("Conversation not found");
  return c;
}

/** Starts (or returns the patient's current) recording conversation. */
export async function startConversation(patientId: string, input: { visitId?: string | null; personId?: string | null }) {
  const [existing] = await db()
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.patientId, patientId), eq(conversations.status, "recording")))
    .orderBy(desc(conversations.startedAt))
    .limit(1);
  if (existing) return { conversationId: existing.id, existing: true };

  let visitId = input.visitId ?? null;
  let personId = input.personId ?? null;
  if (visitId) {
    const [v] = await db().select().from(visits).where(and(eq(visits.id, visitId), eq(visits.patientId, patientId)));
    if (!v) throw unprocessable("That visit isn't for this patient");
    personId = v.personId;
  } else if (personId) {
    const [p] = await db().select({ id: people.id }).from(people).where(and(eq(people.id, personId), eq(people.patientId, patientId)));
    if (!p) throw unprocessable("That person isn't in this patient's list");
    const [v] = await db()
      .select({ id: visits.id })
      .from(visits)
      .where(and(eq(visits.personId, personId), eq(visits.patientId, patientId)))
      .orderBy(desc(visits.startedAt))
      .limit(1);
    visitId = v?.id ?? null;
  }
  const [c] = await db().insert(conversations).values({ patientId, visitId, personId }).returning({ id: conversations.id });
  return { conversationId: c.id, existing: false };
}

export function readableTranscript(t: Transcription) {
  return t.segments.map((s) => `${s.speaker}: ${s.text.trim()}`).join("\n");
}

/**
 * Transcribes one WAV chunk and stores only text. The audio buffer is never
 * written anywhere and goes out of scope when this returns.
 */
export async function addChunk(conversation: ConversationRow, seq: number, wav: Buffer) {
  if (conversation.status !== "recording") throw conflict("This conversation isn't recording any more");
  const [existing] = await db()
    .select()
    .from(conversationChunks)
    .where(and(eq(conversationChunks.conversationId, conversation.id), eq(conversationChunks.seq, seq)));
  if (existing?.status === "done") {
    return { seq, status: "done" as const, textPreview: previewOf(existing.transcript) };
  }
  if (!existing) {
    const inserted = await db()
      .insert(conversationChunks)
      .values({ conversationId: conversation.id, seq, status: "processing" })
      .onConflictDoNothing()
      .returning({ id: conversationChunks.id });
    if (!inserted.length) throw conflict("That chunk is already being processed");
  }
  try {
    const t = await transcriber().transcribe(wav);
    await db()
      .update(conversationChunks)
      .set({ status: "done", transcript: JSON.stringify(t), error: null })
      .where(and(eq(conversationChunks.conversationId, conversation.id), eq(conversationChunks.seq, seq)));
    return { seq, status: "done" as const, textPreview: readableTranscript(t).slice(0, 160) };
  } catch (err) {
    await db()
      .update(conversationChunks)
      .set({ status: "failed", error: (err as Error).message.slice(0, 500) })
      .where(and(eq(conversationChunks.conversationId, conversation.id), eq(conversationChunks.seq, seq)));
    throw upstream("We couldn't hear that part. The rest will still be saved.");
  }
}

function parseChunk(json: string | null): Transcription | null {
  if (!json) return null;
  try {
    const r = transcriptionSchema.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

function previewOf(json: string | null) {
  const t = parseChunk(json);
  return t ? readableTranscript(t).slice(0, 160) : "";
}

/** Joins chunk transcripts → summary → voice cross-check → stores the result. */
export async function finishConversation(conversation: ConversationRow, now = new Date()) {
  if (conversation.status === "done" || conversation.status === "failed") {
    return finishedResult(conversation, null);
  }
  await db().update(conversations).set({ status: "processing", endedAt: now }).where(eq(conversations.id, conversation.id));
  const chunks = await db()
    .select()
    .from(conversationChunks)
    .where(eq(conversationChunks.conversationId, conversation.id))
    .orderBy(asc(conversationChunks.seq));
  const parsed = chunks.filter((c) => c.status === "done").map((c) => parseChunk(c.transcript)).filter((t): t is Transcription => !!t);
  const failedCount = chunks.filter((c) => c.status !== "done").length;
  const transcript = parsed.map(readableTranscript).filter(Boolean).join("\n");
  const claimedNames = parsed.flatMap((t) => t.selfIntroductions.map((s) => s.name));

  const patient = await getPatient(conversation.patientId);
  const approved = await db()
    .select({ id: people.id, name: people.name, spokenName: people.spokenName, relationship: people.relationship })
    .from(people)
    .where(and(eq(people.patientId, conversation.patientId), eq(people.status, "approved")));
  const facePerson = conversation.personId ? (approved.find((p) => p.id === conversation.personId) ?? null) : null;

  // §5.4 voice cross-check.
  const claim = identifier.identify({ claimedNames, facePerson, approved });
  let personId = conversation.personId;
  let mightBe: { personId: string; name: string } | null = null;
  if (claim && claim.matchesFace === null && claim.matchedPersonId) {
    const p = approved.find((x) => x.id === claim.matchedPersonId)!;
    personId = p.id;
    mightBe = { personId: p.id, name: p.name! };
    await db().insert(recognitionEvents).values({ patientId: conversation.patientId, personId: p.id, source: "voice", confidence: 0.5, detectedAt: now });
  }
  const about = approved.find((p) => p.id === personId) ?? null;

  if (!parsed.length && failedCount > 0) {
    const [row] = await db()
      .update(conversations)
      .set({ status: "failed", transcript: "", speakerClaim: claim, personId })
      .where(eq(conversations.id, conversation.id))
      .returning();
    return finishedResult(row!, mightBe);
  }

  let summary: string;
  let keyFacts: string[];
  const fallback = `You talked with ${about?.name ?? "someone"}.`;
  if (!transcript.trim()) {
    summary = fallback;
    keyFacts = [];
  } else {
    try {
      const s = await summarizer().summarize({
        transcript,
        personName: about?.name ?? null,
        relationship: about?.relationship ?? null,
        patientName: patient.preferredName,
      });
      summary = s.summary.trim();
      keyFacts = s.keyFacts.map((f) => f.trim()).filter(Boolean).slice(0, 5);
    } catch (err) {
      console.warn("[conversation] summary failed, using fallback", (err as Error).message);
      summary = fallback;
      keyFacts = [];
    }
  }
  const [row] = await db()
    .update(conversations)
    .set({ status: "done", transcript, summary, keyFacts, speakerClaim: claim, personId })
    .where(eq(conversations.id, conversation.id))
    .returning();
  return finishedResult(row!, mightBe);
}

function finishedResult(c: ConversationRow, mightBe: { personId: string; name: string } | null) {
  return {
    status: c.status as "done" | "failed",
    summary: c.summary,
    keyFacts: c.keyFacts,
    speakerClaim: c.speakerClaim as SpeakerClaim | null,
    mightBe,
  };
}

export async function listConversations(patientId: string, personId?: string) {
  const rows = await db()
    .select({
      id: conversations.id,
      status: conversations.status,
      startedAt: conversations.startedAt,
      endedAt: conversations.endedAt,
      summary: conversations.summary,
      keyFacts: conversations.keyFacts,
      speakerClaim: conversations.speakerClaim,
      personId: conversations.personId,
      personName: people.name,
    })
    .from(conversations)
    .leftJoin(people, eq(people.id, conversations.personId))
    .where(and(eq(conversations.patientId, patientId), personId ? eq(conversations.personId, personId) : undefined))
    .orderBy(desc(conversations.startedAt))
    .limit(100);
  return rows;
}
