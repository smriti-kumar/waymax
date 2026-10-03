// Prints which configured Gemini model ids exist for this API key.
import { GoogleGenAI } from "@google/genai";

export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey });
  const ids: string[] = [];
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  for await (const m of pager) {
    if (m.name) ids.push(m.name.replace(/^models\//, ""));
  }
  return ids;
}

async function main() {
  const key = process.env.GEMINI_API_KEY?.trim();
  const configured = [
    process.env.GEMINI_MODEL || "gemini-3-flash-preview",
    process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite",
  ];
  if (!key) {
    console.log("verify-gemini-models: skipped — no key (GEMINI_API_KEY is empty)");
    return;
  }
  const ids = await listGeminiModels(key);
  for (const id of configured) {
    console.log(`${ids.includes(id) ? "✓" : "✗"} ${id}`);
  }
  const flash = ids.filter((id) => /flash/.test(id) && !/2\.5|tts|image|live|audio/.test(id));
  console.log(`\nAvailable Flash models: ${flash.join(", ") || "(none)"}`);
}

if (process.argv[1]?.endsWith("verify-gemini-models.ts")) {
  main().catch((err) => {
    console.error("verify-gemini-models failed:", (err as Error).message);
    process.exit(1);
  });
}
