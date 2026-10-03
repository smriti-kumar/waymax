import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { env } from "@/server/env";

let app: App | null = null;

/** Firebase Admin app from the service account in env (FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY). */
export function firebaseAdmin(): App {
  if (app) return app;
  const e = env();
  if (!e.FIREBASE_PROJECT_ID || !e.FIREBASE_CLIENT_EMAIL || !e.FIREBASE_PRIVATE_KEY) throw new Error("Firebase Admin is not configured");
  const name = "waymax";
  app = getApps().some((a) => a.name === name)
    ? getApp(name)
    : initializeApp(
        {
          credential: cert({
            projectId: e.FIREBASE_PROJECT_ID,
            clientEmail: e.FIREBASE_CLIENT_EMAIL,
            // Env vars usually carry the PEM with literal "\n".
            privateKey: e.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          }),
        },
        name,
      );
  return app;
}

type Verifier = (idToken: string) => Promise<Pick<DecodedIdToken, "uid" | "email" | "name" | "email_verified">>;
let verifierOverride: Verifier | null = null;

/** Tests only: replace Firebase token verification. */
export function setFirebaseVerifier(v: Verifier | null) {
  verifierOverride = v;
}

export async function verifyFirebaseToken(idToken: string) {
  if (verifierOverride) return verifierOverride(idToken);
  return getAuth(firebaseAdmin()).verifyIdToken(idToken, true);
}
