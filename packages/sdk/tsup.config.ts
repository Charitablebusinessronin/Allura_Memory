import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: {
    resolve: true,
  },
  sourcemap: true,
  clean: true,
  splitting: false,
  minify: false,
  target: "es2022",
  platform: "neutral",
  outDir: "dist",
  banner: {
    js: `/**\n * @allura/sdk — TypeScript SDK for Allura Memory\n * Copyright (c) Allura Memory Team. MIT License.\n */`,
  },
});