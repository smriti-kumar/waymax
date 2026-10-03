import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Tests never hit real AI, TTS or Photon (PLAN §11).
process.env.AI_MOCK = "true";
process.env.NOTIFY_MODE = "in_app";
process.env.NEXT_PUBLIC_DEMO_MODE = "true";
process.env.SESSION_SECRET ||= "test-session-secret-0123456789";
process.env.WORKER_SECRET ||= "test-worker-secret";
// Integration suites run against the test database only.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
else process.env.DATABASE_URL ||= "postgres://unset@localhost:5432/unset";
