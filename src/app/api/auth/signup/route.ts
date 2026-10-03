import { signupBody } from "@/lib/contracts/auth";
import { setSessionCookie } from "@/server/auth/cookies";
import { createSession } from "@/server/auth/sessions";
import { json, route } from "@/server/http/route";
import { env } from "@/server/env";
import { ApiError } from "@/server/http/errors";
import { signup } from "@/server/services/caregivers";

export const runtime = "nodejs";

export const POST = route({ body: signupBody }, async ({ body }) => {
  // With Firebase on, accounts are created and checked by Firebase (see /api/auth/firebase).
  if (env().authMode === "firebase") throw new ApiError("CONFLICT", "Please use the sign-in page.");
  const caregiver = await signup(body);
  const { token } = await createSession(caregiver.id);
  const res = json({ caregiver }, 201);
  setSessionCookie(res, token);
  return res;
});
