import { signupBody } from "@/lib/contracts/auth";
import { setSessionCookie } from "@/server/auth/cookies";
import { createSession } from "@/server/auth/sessions";
import { json, route } from "@/server/http/route";
import { signup } from "@/server/services/caregivers";

export const runtime = "nodejs";

export const POST = route({ body: signupBody }, async ({ body }) => {
  const caregiver = await signup(body);
  const { token } = await createSession(caregiver.id);
  const res = json({ caregiver }, 201);
  setSessionCookie(res, token);
  return res;
});
