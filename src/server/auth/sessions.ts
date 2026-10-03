import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/server/db/client";
import { caregivers, sessions } from "@/server/db/schema";
import { SESSION_DAYS } from "./cookies";
import { hashToken, newToken } from "./tokens";

export type Caregiver = { id: string; email: string; name: string; phoneE164: string | null };

export async function createSession(caregiverId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db().insert(sessions).values({ id: hashToken(token), caregiverId, expiresAt });
  // Opportunistic cleanup of this caregiver's expired sessions.
  await db()
    .delete(sessions)
    .where(and(eq(sessions.caregiverId, caregiverId), lt(sessions.expiresAt, new Date())));
  return { token, expiresAt };
}

export async function caregiverForToken(token: string | undefined): Promise<Caregiver | null> {
  if (!token) return null;
  const rows = await db()
    .select({ id: caregivers.id, email: caregivers.email, name: caregivers.name, phoneE164: caregivers.phoneE164 })
    .from(sessions)
    .innerJoin(caregivers, eq(caregivers.id, sessions.caregiverId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteSession(token: string) {
  await db().delete(sessions).where(eq(sessions.id, hashToken(token)));
}
