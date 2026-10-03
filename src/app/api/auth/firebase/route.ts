import { z } from "zod";
import { e164 } from "@/lib/contracts/common";
import { setSessionCookie } from "@/server/auth/cookies";
import { verifyFirebaseToken } from "@/server/auth/firebase";
import { createSession } from "@/server/auth/sessions";
import { env } from "@/server/env";
import { notFound, unauthorized } from "@/server/http/errors";
import { json, route } from "@/server/http/route";
import { caregiverForFirebase } from "@/server/services/caregivers";

export const runtime = "nodejs";

const body = z.object({
  idToken: z.string().min(20),
  name: z.string().trim().min(1).max(100).optional(),
  phoneE164: e164.optional().or(z.literal("").transform(() => undefined)),
});

/** Exchanges a Firebase ID token for the app's session cookie (creating or linking the caregiver). */
export const POST = route({ body }, async ({ body }) => {
  if (env().authMode !== "firebase") throw notFound();
  let decoded;
  try {
    decoded = await verifyFirebaseToken(body.idToken);
  } catch {
    throw unauthorized("Your sign-in expired. Please sign in again.");
  }
  if (!decoded.email) throw unauthorized("This account has no email address.");
  const { caregiver, created } = await caregiverForFirebase({
    uid: decoded.uid,
    email: decoded.email.toLowerCase(),
    name: body.name ?? decoded.name ?? decoded.email.split("@")[0]!,
    phoneE164: body.phoneE164 ?? null,
  });
  const { token } = await createSession(caregiver.id);
  const res = json({ caregiver, created }, created ? 201 : 200);
  setSessionCookie(res, token);
  return res;
});
