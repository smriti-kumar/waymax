import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { isLocalUrl } from "./url";

/** Applies drizzle/0000 + 0001 to the given database. Timescale warnings are printed, not fatal. */
export async function runMigrations(url: string, opts: { quiet?: boolean } = {}) {
  const warnings: string[] = [];
  const sql = postgres(url, {
    max: 1,
    ssl: isLocalUrl(url) ? false : "require",
    onnotice: (n) => {
      if (n.severity === "WARNING") warnings.push(String(n.message));
    },
  });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  } finally {
    await sql.end({ timeout: 5 });
  }
  if (!opts.quiet) for (const w of warnings) console.warn(`[migrate] ${w}`);
  return { warnings };
}
