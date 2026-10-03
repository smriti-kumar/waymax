// Loads the demo account (PLAN T18). `pnpm db:seed` — add `-- --force` to rebuild it.
import { closeDb } from "../src/server/db/client";
import { seedDemo } from "../src/server/seed/demo";

const started = Date.now();
seedDemo({ force: process.argv.includes("--force") })
  .then((summary) => console.log(`${summary}\n(done in ${((Date.now() - started) / 1000).toFixed(1)}s)`))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
