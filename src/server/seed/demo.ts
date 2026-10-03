import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { caregivers } from "@/server/db/schema";

export const DEMO_EMAIL = "demo@waymax.app";

/** Loads demo data. Idempotent: does nothing if the demo caregiver already exists. */
export async function seedDemo(): Promise<string> {
  const existing = await db().select({ id: caregivers.id }).from(caregivers).where(eq(caregivers.email, DEMO_EMAIL));
  if (existing.length) return "Demo data already present.";
  return "Nothing to seed yet.";
}
