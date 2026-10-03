// Writes src/generated/calm-tracks.json from the audio files in public/audio/calm/.
// Serverless functions can't read public/ at runtime, so the list is baked in at build.
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "public", "audio", "calm");
let files = [];
try {
  files = readdirSync(dir)
    .filter((f) => /\.(mp3|m4a|ogg|wav)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
} catch {
  /* folder missing: no tracks */
}
mkdirSync(join(process.cwd(), "src", "generated"), { recursive: true });
writeFileSync(
  join(process.cwd(), "src", "generated", "calm-tracks.json"),
  JSON.stringify(files.map((f) => `/audio/calm/${encodeURIComponent(f)}`), null, 2) + "\n",
);
console.log(`[calm-tracks] ${files.length} track(s)`);
