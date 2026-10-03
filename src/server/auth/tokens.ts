import "server-only";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { env } from "@/server/env";

/** 32 random bytes, base64url — the value that lives in a cookie or header. */
export function newToken() {
  return randomBytes(32).toString("base64url");
}

/** What we store: HMAC-SHA256(SESSION_SECRET, token). A DB leak can't be replayed as a cookie. */
export function hashToken(token: string) {
  return createHmac("sha256", env().SESSION_SECRET).update(token).digest("hex");
}

export function sixDigitCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
