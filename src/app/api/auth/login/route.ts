import { loginBody } from "@/lib/contracts/auth";
import { setSessionCookie } from "@/server/auth/cookies";
import { createSession } from "@/server/auth/sessions";
import { json, route } from "@/server/http/route";
import { login } from "@/server/services/caregivers";

export const runtime = "nodejs";

export const POST = route({ body: loginBody }, async ({ body }) => {
  const caregiver = await login(body.email, body.password);
  const { token } = await createSession(caregiver.id);
  const res = json({ caregiver });
  setSessionCookie(res, token);
  return res;
});
