import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
