import { defineConfig } from "vitest/config";
import path from "node:path";
import { config } from "dotenv";

// Load environment variables for tests
config();

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
