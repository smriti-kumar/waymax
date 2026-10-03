import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { questions } from "@/server/db/schema";
import { notFound, unprocessable } from "@/server/http/errors";
import { isUuid } from "@/server/auth/guards";

const cols = {
  id: questions.id,
  question: questions.question,
  answer: questions.answer,
  sortOrder: questions.sortOrder,
  isActive: questions.isActive,
};

export async function listQuestions(pid: string, activeOnly = false) {
  return db()
    .select(cols)
    .from(questions)
    .where(and(eq(questions.patientId, pid), activeOnly ? eq(questions.isActive, true) : undefined))
    .orderBy(asc(questions.sortOrder), asc(questions.createdAt));
}

export async function createQuestion(pid: string, input: { question: string; answer: string; sortOrder?: number; isActive: boolean }) {
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const [m] = await db()
      .select({ max: sql<number>`coalesce(max(${questions.sortOrder}), -1)::int` })
      .from(questions)
      .where(eq(questions.patientId, pid));
    sortOrder = Number(m?.max ?? -1) + 1;
  }
  const [q] = await db().insert(questions).values({ patientId: pid, ...input, sortOrder }).returning(cols);
  return q;
}

async function own(pid: string, id: string) {
  if (!isUuid(id)) throw notFound("Question not found");
  const [q] = await db().select({ id: questions.id }).from(questions).where(and(eq(questions.id, id), eq(questions.patientId, pid)));
  if (!q) throw notFound("Question not found");
}

export async function updateQuestion(pid: string, id: string, patch: Partial<{ question: string; answer: string; sortOrder: number; isActive: boolean }>) {
  await own(pid, id);
  const [q] = await db().update(questions).set(patch).where(eq(questions.id, id)).returning(cols);
  return q;
}

export async function deleteQuestion(pid: string, id: string) {
  await own(pid, id);
  await db().delete(questions).where(eq(questions.id, id));
}

/** Sets sort_order to the position of each id in `ids` (must be exactly this patient's questions). */
export async function reorderQuestions(pid: string, ids: string[]) {
  const current = await listQuestions(pid);
  const known = new Set(current.map((q) => q.id));
  if (ids.length !== known.size || !ids.every((id) => known.has(id)) || new Set(ids).size !== ids.length)
    throw unprocessable("Send every question exactly once");
  await db().transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.update(questions).set({ sortOrder: i }).where(eq(questions.id, id));
  });
  return listQuestions(pid);
}
