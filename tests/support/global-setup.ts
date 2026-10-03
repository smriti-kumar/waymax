import { config } from "dotenv";
import { dropEverything } from "../../src/server/db/reset";
import { runMigrations } from "../../src/server/db/migrate";

/** Rebuilds waymax_test from scratch once per `vitest run`. */
export default async function setup() {
  config({ path: ".env.local", quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn("\n⚠ TEST_DATABASE_URL is not set: database integration suites will be skipped.\n");
    return;
  }
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("TEST_DATABASE_URL must point at a local database");
  await dropEverything(url);
  await runMigrations(url, { quiet: true });
}
