import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright config for Allura Memory Dashboard E2E benchmark tests.
 *
 * Usage:
 *   npx playwright test --config=benchmark/playwright.config.ts
 *   npx playwright test --config=benchmark/playwright.config.ts --headed
 *   npx playwright test --config=benchmark/playwright.config.ts -g "search"
 */
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "benchmark/report" }]],
  timeout: 30_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL: process.env.ALLURA_DASHBOARD_URL ?? "http://localhost:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "bun run dev",
    cwd: "../",
    port: 3100,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})