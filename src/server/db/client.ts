import "server-only";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { env } from "@/server/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

type Shared = { sql?: postgres.Sql; db?: Db; url?: string };
const g = globalThis as unknown as { __waymaxDb?: Shared };
const shared: Shared = (g.__waymaxDb ??= {});

export function isLocalUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/** One shared postgres.js pool per process (survives Next dev hot reloads). */
export function sqlClient(): postgres.Sql {
  const url = env().DATABASE_URL;
  if (!shared.sql || shared.url !== url) {
    shared.sql = postgres(url, {
      max: 3,
      idle_timeout: 20,
      ssl: isLocalUrl(url) ? false : "require",
      onnotice: () => {},
    });
    shared.db = drizzle(shared.sql, { schema });
    shared.url = url;
  }
  return shared.sql;
}

export function db(): Db {
  sqlClient();
  return shared.db!;
}

export async function closeDb() {
  if (shared.sql) await shared.sql.end({ timeout: 5 });
  shared.sql = undefined;
  shared.db = undefined;
  shared.url = undefined;
}
