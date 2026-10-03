import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // "server-only" throws outside React Server Components; tests run server code directly.
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/support/setup.ts"],
    // Integration suites share one test database, so files run one at a time.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
