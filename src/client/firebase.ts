"use client";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Firebase sign-in is used when its browser config is present. */
export const FIREBASE_ENABLED = !!(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;

export function firebaseAuth(): Auth {
  app ??= getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}

/** Plain-language messages for Firebase Auth error codes. */
export function friendlyFirebaseError(code: string | undefined): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Email or password is incorrect";
    case "auth/email-already-in-use":
      return "An account with that email already exists. Try signing in.";
    case "auth/weak-password":
      return "Choose a password with at least 8 characters.";
    case "auth/too-many-requests":
      return "Too many tries. Please wait a minute and try again.";
    case "auth/network-request-failed":
      return "Check your internet connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
