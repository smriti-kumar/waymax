// Caches the demo's spoken phrases in ElevenLabs once, so the live demo is instant
// and each phrase is paid for only once (PLAN §5.8). Skips in mock mode.
import { eq } from "drizzle-orm";
import { closeDb, db } from "../src/server/db/client";
import { caregivers, patientCaregivers } from "../src/server/db/schema";
import { prewarmPhrases } from "../src/server/seed/phrases";
import { env } from "../src/server/env";
import { tts } from "../src/server/ai";
import { speech, charsUsedThisMonth } from "../src/server/services/tts";
import { DEMO_EMAIL } from "../src/server/seed/demo";

async function main() {
  const provider = tts();
  if (!provider) {
    console.log(`tts:prewarm skipped — speech is in mock mode (${env().ttsMode}); the browser voice is used.`);
    return;
  }
  const email = process.argv.find((a) => a.startsWith("--email="))?.slice(8) ?? DEMO_EMAIL;
  const [cg] = await db().select().from(caregivers).where(eq(caregivers.email, email));
  if (!cg) throw new Error(`No caregiver ${email}; run pnpm db:seed first`);
  const pids = (await db().select({ pid: patientCaregivers.patientId }).from(patientCaregivers).where(eq(patientCaregivers.caregiverId, cg.id))).map((r) => r.pid);
  let chars = 0;
  let cached = 0;
  let fresh = 0;
  let fallbacks = 0;
  for (const pid of pids) {
    for (const text of await prewarmPhrases(pid)) {
      const r = await speech(text, pid);
      if (r.kind === "audio") {
        if (r.cached) cached++;
        else {
          fresh++;
          chars += text.length;
        }
      } else {
        fallbacks++;
        console.warn(`  fallback (${r.reason}): ${text.slice(0, 60)}`);
        if (r.reason === "budget") break;
      }
    }
  }
  const used = await charsUsedThisMonth(provider.provider);
  console.log(`Prewarmed: ${fresh} new (${chars} chars), ${cached} already cached, ${fallbacks} fallbacks. Month so far: ${used}/${env().TTS_MONTHLY_CHAR_BUDGET} chars.`);
}

main()
  .catch((err) => {
    console.error("tts:prewarm failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
