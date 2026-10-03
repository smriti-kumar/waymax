import "server-only";
import type { NextResponse } from "next/server";
import { env } from "@/server/env";

export const SESSION_COOKIE = "wm_session";
export const DEVICE_COOKIE = "wm_device";
export const SESSION_DAYS = 30;
export const DEVICE_DAYS = 365;

function secure() {
  const e = env();
  return e.NODE_ENV === "production" || e.NEXT_PUBLIC_APP_URL.startsWith("https://");
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: 0 });
}

export function setDeviceCookie(res: NextResponse, token: string) {
  res.cookies.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_DAYS * 86400,
  });
}
