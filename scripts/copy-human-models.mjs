// Copies the face models Waymax uses from @vladmandic/human into public/models/human.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const MODELS = ["blazeface", "facemesh", "iris", "faceres"];

// The package's "exports" map hides package.json, so locate it from the main entry.
let srcDir;
try {
  let dir = dirname(require.resolve("@vladmandic/human"));
  while (!existsSync(join(dir, "models")) && dirname(dir) !== dir) dir = dirname(dir);
  srcDir = join(dir, "models");
} catch {
  console.warn("[copy-human-models] @vladmandic/human not installed yet, skipping");
  process.exit(0);
}
const outDir = join(process.cwd(), "public", "models", "human");
mkdirSync(outDir, { recursive: true });
let n = 0;
for (const m of MODELS) {
  for (const ext of [".json", ".bin"]) {
    const src = join(srcDir, m + ext);
    if (existsSync(src)) {
      copyFileSync(src, join(outDir, m + ext));
      n++;
    }
  }
}
console.log(`[copy-human-models] copied ${n} files to public/models/human`);
