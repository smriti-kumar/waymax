// Dev only: drops everything and re-runs both migrations. Never point this at Tiger.
import { assertResettable, dropEverything } from "../src/server/db/reset";
import { runMigrations } from "../src/server/db/migrate";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  assertResettable(url, process.env.NODE_ENV, process.argv.includes("--force-remote"));
  await dropEverything(url);
  await runMigrations(url);
  console.log("Database reset and migrated.");
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
