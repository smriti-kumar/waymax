import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { caregivers, patientCaregivers, patients } from "@/server/db/schema";
import type { SignupBody } from "@/lib/contracts/auth";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/server/auth/passwords";
import { conflict, unauthorized } from "@/server/http/errors";

const publicCols = { id: caregivers.id, email: caregivers.email, name: caregivers.name, phoneE164: caregivers.phoneE164 };

export async function signup(input: SignupBody) {
  const existing = await db().select({ id: caregivers.id }).from(caregivers).where(eq(caregivers.email, input.email));
  if (existing.length) throw conflict("An account with that email already exists");
  const passwordHash = await hashPassword(input.password);
  const [cg] = await db()
    .insert(caregivers)
    .values({ email: input.email, passwordHash, name: input.name, phoneE164: input.phoneE164 ?? null })
    .onConflictDoNothing()
    .returning(publicCols);
  if (!cg) throw conflict("An account with that email already exists");
  return cg;
}

/** Marker stored as password_hash for Firebase-only accounts (never a valid bcrypt hash). */
export const FIREBASE_ONLY = "firebase-only";

export async function login(email: string, password: string) {
  const [row] = await db().select().from(caregivers).where(eq(caregivers.email, email.toLowerCase()));
  const hash = row?.passwordHash?.startsWith("$2") ? row.passwordHash : DUMMY_HASH;
  const ok = (await verifyPassword(password, hash)) && hash !== DUMMY_HASH;
  if (!row || !ok) throw unauthorized("Email or password is incorrect");
  return { id: row.id, email: row.email, name: row.name, phoneE164: row.phoneE164 };
}

export async function patientsForCaregiver(caregiverId: string) {
  return db()
    .select({ id: patients.id, preferredName: patients.preferredName, name: patients.name, role: patientCaregivers.role })
    .from(patientCaregivers)
    .innerJoin(patients, eq(patients.id, patientCaregivers.patientId))
    .where(eq(patientCaregivers.caregiverId, caregiverId))
    .orderBy(asc(patients.createdAt));
}

/** Finds the caregiver for a Firebase user: by uid, else by email (linking it), else creates one. */
export async function caregiverForFirebase(input: { uid: string; email: string; name: string; phoneE164: string | null }) {
  const [byUid] = await db().select(publicCols).from(caregivers).where(eq(caregivers.firebaseUid, input.uid));
  if (byUid) return { caregiver: byUid, created: false };
  const [byEmail] = await db().select(publicCols).from(caregivers).where(eq(caregivers.email, input.email));
  if (byEmail) {
    await db().update(caregivers).set({ firebaseUid: input.uid }).where(eq(caregivers.id, byEmail.id));
    return { caregiver: byEmail, created: false };
  }
  const [cg] = await db()
    .insert(caregivers)
    .values({ email: input.email, name: input.name, phoneE164: input.phoneE164, passwordHash: FIREBASE_ONLY, firebaseUid: input.uid })
    .returning(publicCols);
  return { caregiver: cg, created: true };
}
