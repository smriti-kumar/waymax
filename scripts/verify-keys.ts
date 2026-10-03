// Checks each external key in .env.local and prints a pass/fail table (PLAN T20 Part B).
import postgres from "postgres";
import { GoogleGenAI } from "@google/genai";
import { listGeminiModels } from "./verify-gemini-models";

type Row = { service: string; status: "pass" | "fail" | "skipped"; detail: string };
const rows: Row[] = [];
const e = process.env;
const blank = (v?: string) => !v || v.trim() === "";

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms} ms`)), ms)),
  ]);
}

async function checkDb() {
  if (blank(e.DATABASE_URL)) return rows.push({ service: "Database", status: "fail", detail: "DATABASE_URL empty" });
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(e.DATABASE_URL!);
  const sql = postgres(e.DATABASE_URL!, { max: 1, ssl: local ? false : "require", onnotice: () => {} });
  try {
    await withTimeout(sql`select 1`, 15000, "connect");
    const ext = await sql`select extversion from pg_extension where extname = 'timescaledb'`;
    const avail = await sql`select default_version from pg_available_extensions where name = 'timescaledb'`;
    const where = local ? "local" : "remote";
    if (ext.length) rows.push({ service: "Database", status: "pass", detail: `${where}, timescaledb ${ext[0].extversion}` });
    else if (avail.length)
      rows.push({ service: "Database", status: "pass", detail: `${where}, timescaledb available (run pnpm db:migrate)` });
    else rows.push({ service: "Database", status: "fail", detail: `${where}, timescaledb extension not available` });
  } catch (err) {
    rows.push({ service: "Database", status: "fail", detail: (err as Error).message });
  } finally {
    await sql.end({ timeout: 2 });
  }
}

async function checkGemini() {
  if (blank(e.GEMINI_API_KEY)) return rows.push({ service: "Gemini", status: "skipped", detail: "skipped — no key" });
  const model = e.GEMINI_MODEL || "gemini-3-flash-preview";
  const fallback = e.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";
  try {
    const ids = await withTimeout(listGeminiModels(e.GEMINI_API_KEY!), 20000, "list models");
    const missing = [model, fallback].filter((m) => !ids.includes(m));
    const ai = new GoogleGenAI({ apiKey: e.GEMINI_API_KEY! });
    const useModel = ids.includes(model) ? model : ids.find((i) => /flash/.test(i) && !/2\.5|tts|image|live|audio/.test(i));
    if (!useModel) return rows.push({ service: "Gemini", status: "fail", detail: "no Flash model available for this key" });
    const res = await withTimeout(
      ai.models.generateContent({ model: useModel, contents: "Reply with exactly: ready" }),
      20000,
      "generateContent",
    );
    const text = (res.text ?? "").trim().slice(0, 40);
    const note = missing.length ? ` — missing ids: ${missing.join(", ")}; try GEMINI_MODEL=${useModel}` : "";
    rows.push({ service: "Gemini", status: missing.includes(model) ? "fail" : "pass", detail: `${useModel} said "${text}"${note}` });
  } catch (err) {
    rows.push({ service: "Gemini", status: "fail", detail: (err as Error).message.slice(0, 200) });
  }
}

async function checkElevenLabs() {
  if (blank(e.ELEVENLABS_API_KEY)) return rows.push({ service: "ElevenLabs", status: "skipped", detail: "skipped — no key" });
  if (blank(e.ELEVENLABS_VOICE_ID)) return rows.push({ service: "ElevenLabs", status: "fail", detail: "ELEVENLABS_VOICE_ID empty" });
  try {
    const res = await withTimeout(
      fetch(`https://api.elevenlabs.io/v1/text-to-speech/${e.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_64`, {
        method: "POST",
        headers: { "xi-api-key": e.ELEVENLABS_API_KEY!, "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({ text: "Hello, this is Waymax.", model_id: e.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5" }),
      }),
      15000,
      "ElevenLabs",
    );
    if (!res.ok) {
      const body = (await res.text()).slice(0, 160);
      return rows.push({ service: "ElevenLabs", status: "fail", detail: `HTTP ${res.status}: ${body}` });
    }
    const bytes = (await res.arrayBuffer()).byteLength;
    rows.push({ service: "ElevenLabs", status: "pass", detail: `spoke 5 words (${bytes} bytes mp3)` });
  } catch (err) {
    rows.push({ service: "ElevenLabs", status: "fail", detail: (err as Error).message });
  }
}

async function checkPhoton() {
  if (blank(e.SPECTRUM_PROJECT_ID) || blank(e.SPECTRUM_PROJECT_SECRET))
    return rows.push({ service: "Photon", status: "skipped", detail: "skipped — no key" });
  try {
    const { Spectrum } = await import("spectrum-ts");
    const { imessage } = await import("spectrum-ts/providers/imessage");
    const app = await withTimeout(
      Promise.resolve(
        Spectrum({
          projectId: e.SPECTRUM_PROJECT_ID!,
          projectSecret: e.SPECTRUM_PROJECT_SECRET!,
          providers: [imessage.config()],
        }),
      ),
      20000,
      "Spectrum init",
    );
    await app.stop();
    rows.push({ service: "Photon", status: "pass", detail: "Spectrum initialized (no message sent)" });
  } catch (err) {
    rows.push({ service: "Photon", status: "fail", detail: (err as Error).message.slice(0, 200) });
  }
}

async function main() {
  await checkDb();
  await checkGemini();
  await checkElevenLabs();
  await checkPhoton();
  console.log("\nService     | Status  | Detail");
  console.log("------------|---------|-------");
  for (const r of rows) console.log(`${r.service.padEnd(11)} | ${r.status.padEnd(7)} | ${r.detail}`);
  process.exit(rows.some((r) => r.status === "fail") ? 1 : 0);
}

main();
