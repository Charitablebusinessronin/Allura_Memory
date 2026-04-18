import { defineConfig } from "vitest/config";
import path from "node:path";
import { config } from "dotenv";

// Load environment variables for tests
config();

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.test.ts",
    ],
    passWithNoTests: true,
  },
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
      {
        find: "@mcp-docker/playwright",
        replacement: path.resolve(__dirname, "./tests/mcp/browser/__mocks__/@mcp-docker/playwright.ts"),
      },
      {
        find: "@mcp-docker/next-devtools",
        replacement: path.resolve(__dirname, "./tests/mcp/integration/__mocks__/@mcp-docker/next-devtools.ts"),
      },
    ],
  },
});
