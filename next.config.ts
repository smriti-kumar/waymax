import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The E2E server runs beside `next dev` with its own build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Human's package "exports" picks its Node build (which needs tfjs-node) under the
  // "node" condition; the browser must always get the self-contained ESM bundle.
  turbopack: {
    resolveAlias: {
      "@vladmandic/human": "./node_modules/@vladmandic/human/dist/human.esm.js",
    },
  },
  serverExternalPackages: ["@vladmandic/human"],
};

export default nextConfig;
