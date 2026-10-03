import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { people, questions } from "@/server/db/schema";
import { buildSlideshow } from "@/server/services/memories";
import { buildSayText } from "@/lib/text";

/** Every fixed phrase the demo speaks for a patient (names, previews, narration, answers). */
export async function prewarmPhrases(patientId: string) {
  const out: string[] = [];
  const ppl = await db().select().from(people).where(and(eq(people.patientId, patientId), eq(people.status, "approved")));
  for (const p of ppl) {
    out.push(buildSayText(p.name!, p.spokenName, p.relationship));
    out.push(`${p.spokenName || p.name}, your ${p.relationship}.`);
    const show = await buildSlideshow(patientId, p.id);
    out.push(`${show.intro} ${show.slides[0]?.caption ?? ""}`.trim());
    for (const s of show.slides.slice(1)) out.push(s.caption);
    if (show.outro) out.push(show.outro);
  }
  const qs = await db().select({ answer: questions.answer }).from(questions).where(and(eq(questions.patientId, patientId), eq(questions.isActive, true)));
  out.push(...qs.map((q) => q.answer));
  return [...new Set(out.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean))];
}
