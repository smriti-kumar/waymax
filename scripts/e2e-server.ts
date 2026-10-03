// Playwright webServer: fresh local E2E database, then `next dev` with mocks on.
import { spawn } from "node:child_process";
import { dropEverything } from "../src/server/db/reset";
import { runMigrations } from "../src/server/db/migrate";

const url = process.env.E2E_DATABASE_URL ?? "postgres://waymax:waymax@localhost:5432/waymax_e2e";
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("E2E_DATABASE_URL must be local");
const port = process.env.E2E_PORT ?? "3100";

async function main() {
  await dropEverything(url);
  await runMigrations(url, { quiet: true });
  const child = spawn("pnpm", ["exec", "next", "dev", "--port", port], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: url,
      AI_MOCK: "true",
      NOTIFY_MODE: "in_app",
      NEXT_PUBLIC_DEMO_MODE: "true",
      NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
      NEXT_DIST_DIR: ".next-e2e",
      // E2E uses the built-in password sign-in, the OpenStreetMap map and no real messaging.
      NEXT_PUBLIC_FIREBASE_API_KEY: "",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "",
      FIREBASE_PROJECT_ID: "",
      FIREBASE_CLIENT_EMAIL: "",
      FIREBASE_PRIVATE_KEY: "",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
      PHOTON_DASHBOARD_TOKEN: "",
    },
  });
  const stop = () => child.kill("SIGTERM");
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
