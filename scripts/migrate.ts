import { runMigrations } from "../src/server/db/migrate";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
runMigrations(url)
  .then(({ warnings }) => {
    console.log(`Migrations applied${warnings.length ? ` with ${warnings.length} Timescale warning(s)` : ""}.`);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
