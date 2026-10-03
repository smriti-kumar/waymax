import { NextResponse } from "next/server";
import { clearSessionCookie, SESSION_COOKIE } from "@/server/auth/cookies";
import { requireCaregiver } from "@/server/auth/guards";
import { deleteSession } from "@/server/auth/sessions";
import { route } from "@/server/http/route";

export const runtime = "nodejs";

export const POST = route({}, async ({ req }) => {
  await requireCaregiver(req);
  await deleteSession(req.cookies.get(SESSION_COOKIE)!.value);
  const res = new NextResponse(null, { status: 204 });
  clearSessionCookie(res);
  return res;
});
