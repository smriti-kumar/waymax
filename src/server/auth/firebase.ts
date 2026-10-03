import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/server/env";

export type FirebaseIdentity = { uid: string; email?: string; name?: string; email_verified?: boolean };
type Verifier = (idToken: string) => Promise<FirebaseIdentity>;
let verifierOverride: Verifier | null = null;

/** Tests only: replace Firebase token verification. */
export function setFirebaseVerifier(v: Verifier | null) {
  verifierOverride = v;
}

// Google's public keys for Firebase Auth ID tokens (cached and rotated by jose).
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

/**
 * Verifies a Firebase Auth ID token as Firebase documents for third-party JWT
 * libraries: RS256 signature against Google's keys, issuer, audience, expiry and
 * a non-empty subject. (firebase-admin's verifier pulls in jwks-rsa, which can't
 * load ESM-only `jose` inside the Vercel function bundle.)
 */
export async function verifyFirebaseToken(idToken: string): Promise<FirebaseIdentity> {
  if (verifierOverride) return verifierOverride(idToken);
  const projectId = env().FIREBASE_PROJECT_ID ?? env().NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Firebase is not configured");
  const { payload } = await jwtVerify(idToken, JWKS, {
    algorithms: ["RS256"],
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  if (!payload.sub) throw new Error("token has no subject");
  if (typeof payload.auth_time === "number" && payload.auth_time * 1000 > Date.now() + 60_000) throw new Error("token from the future");
  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    email_verified: payload.email_verified === true,
  };
}
