import postgres from "postgres";
import { isLocalUrl } from "./url";

export function assertResettable(url: string, nodeEnv: string | undefined, forceRemote: boolean) {
  if (nodeEnv === "production") throw new Error("Refusing to reset: NODE_ENV=production");
  if (!isLocalUrl(url) && !forceRemote)
    throw new Error("Refusing to reset a non-localhost database (pass --force-remote to override)");
}

/** Drops every Waymax object (tables, enums, Timescale views, migration journal). */
export async function dropEverything(url: string) {
  const sql = postgres(url, { max: 1, ssl: isLocalUrl(url) ? false : "require", onnotice: () => {} });
  try {
    await sql.unsafe(`
      DROP MATERIALIZED VIEW IF EXISTS patient_events_daily CASCADE;
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
    `);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
