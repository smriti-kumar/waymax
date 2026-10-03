import "server-only";
import { z } from "zod";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalString = z.preprocess(blankToUndefined, z.string().optional());
const boolString = (def: boolean) =>
  z.preprocess(
    blankToUndefined,
    z
      .enum(["true", "false", "1", "0"])
      .optional()
      .transform((v) => (v === undefined ? def : v === "true" || v === "1")),
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.preprocess(
    blankToUndefined,
    z.string({ error: "DATABASE_URL is required (postgres connection string)" }).url(),
  ),
  TEST_DATABASE_URL: optionalString,
  SESSION_SECRET: z.preprocess(
    blankToUndefined,
    z.string({ error: "SESSION_SECRET is required (openssl rand -base64 32)" }).min(16),
  ),
  WORKER_SECRET: optionalString,
  GEMINI_API_KEY: optionalString,
  ELEVENLABS_API_KEY: optionalString,
  SPECTRUM_PROJECT_ID: optionalString,
  SPECTRUM_PROJECT_SECRET: optionalString,
  SPECTRUM_WEBHOOK_SECRET: optionalString,
  /** Photon dashboard login token (from `photon login`), used to register alert numbers automatically. */
  PHOTON_DASHBOARD_TOKEN: optionalString,
  PHOTON_API_HOST: optionalString,
  /** Firebase Admin (service account) — verifies Firebase sign-ins on the server. */
  FIREBASE_PROJECT_ID: optionalString,
  FIREBASE_CLIENT_EMAIL: optionalString,
  FIREBASE_PRIVATE_KEY: optionalString,
  DEMO_ALERT_PHONE: optionalString,

  GEMINI_MODEL: z.preprocess(blankToUndefined, z.string().default("gemini-3-flash-preview")),
  GEMINI_FALLBACK_MODEL: z.preprocess(blankToUndefined, z.string().default("gemini-3.1-flash-lite")),
  ELEVENLABS_VOICE_ID: optionalString,
  ELEVENLABS_MODEL_ID: z.preprocess(blankToUndefined, z.string().default("eleven_flash_v2_5")),
  ELEVENLABS_STT_MODEL: z.preprocess(blankToUndefined, z.string().default("scribe_v1")),
  TTS_MONTHLY_CHAR_BUDGET: z.preprocess(blankToUndefined, z.coerce.number().int().positive().default(18000)),
  NOTIFY_MODE: z.preprocess(blankToUndefined, z.enum(["photon", "in_app"]).default("in_app")),
  AI_MOCK: boolString(false),
  STORAGE_PROVIDER: z.preprocess(blankToUndefined, z.enum(["db"]).default("db")),

  NEXT_PUBLIC_APP_URL: z.preprocess(blankToUndefined, z.string().default("http://localhost:3000")),
  NEXT_PUBLIC_DEMO_MODE: boolString(false),
  NEXT_PUBLIC_FIREBASE_API_KEY: optionalString,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optionalString,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: optionalString,
  NEXT_PUBLIC_FIREBASE_APP_ID: optionalString,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: optionalString,
  NEXT_PUBLIC_FACE_MATCH_THRESHOLD: z.preprocess(blankToUndefined, z.coerce.number().min(0).max(1).default(0.68)),
});

export type RawEnv = z.infer<typeof envSchema>;

export type ProviderMode = "live" | "mock";

export interface Env extends RawEnv {
  /** "firebase" when both the browser config and the server service account are set. */
  authMode: "firebase" | "password";
  geminiMode: ProviderMode;
  ttsMode: ProviderMode;
  /** Effective notify mode: photon only when requested AND keys are present. */
  notifyMode: "photon" | "in_app";
  warnings: string[];
}

/** Pure parser; throws a readable error when required values are missing. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  const raw = result.data;
  const warnings: string[] = [];

  let geminiMode: ProviderMode = "live";
  if (raw.AI_MOCK) geminiMode = "mock";
  else if (!raw.GEMINI_API_KEY) {
    geminiMode = "mock";
    warnings.push("GEMINI_API_KEY missing: Gemini runs in mock mode");
  }

  let ttsMode: ProviderMode = "live";
  if (raw.AI_MOCK) ttsMode = "mock";
  else if (!raw.ELEVENLABS_API_KEY || !raw.ELEVENLABS_VOICE_ID) {
    ttsMode = "mock";
    warnings.push("ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID missing: speech uses the browser voice");
  }

  let notifyMode = raw.NOTIFY_MODE;
  if (notifyMode === "photon" && (!raw.SPECTRUM_PROJECT_ID || !raw.SPECTRUM_PROJECT_SECRET)) {
    notifyMode = "in_app";
    warnings.push("SPECTRUM_PROJECT_ID/SECRET missing: alerts are in-app only");
  }

  const firebaseServer = !!(raw.FIREBASE_PROJECT_ID && raw.FIREBASE_CLIENT_EMAIL && raw.FIREBASE_PRIVATE_KEY);
  const firebaseClient = !!(raw.NEXT_PUBLIC_FIREBASE_API_KEY && raw.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const authMode = firebaseServer && firebaseClient ? "firebase" : "password";
  if (firebaseServer !== firebaseClient) warnings.push("Firebase is half-configured (browser and server keys must both be set): using password sign-in");

  return { ...raw, authMode, geminiMode, ttsMode, notifyMode, warnings };
}

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    cached = parseEnv(process.env);
    for (const w of cached.warnings) console.warn(`[env] ${w}`);
  }
  return cached;
}

/** Tests only: drop the cached env so a changed process.env is re-read. */
export function resetEnvCache() {
  cached = undefined;
}
