import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Tests never hit real AI, TTS or Photon (PLAN §11).
process.env.AI_MOCK = "true";
process.env.NOTIFY_MODE = "in_app";
process.env.NEXT_PUBLIC_DEMO_MODE = "true";
// Built-in password sign-in and no live Photon dashboard calls in tests.
for (const k of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "PHOTON_DASHBOARD_TOKEN"]) delete process.env[k];
process.env.SESSION_SECRET ||= "test-session-secret-0123456789";
process.env.WORKER_SECRET ||= "test-worker-secret";
// Integration suites run against the local test database only — never the real
// DATABASE_URL (which may be Tiger once keys are in .env.local).
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl && !/@(localhost|127\.0\.0\.1)[:/]/.test(testUrl)) throw new Error("TEST_DATABASE_URL must be a local database");
process.env.DATABASE_URL = testUrl || "postgres://unset@localhost:5432/unset";
