import { config as loadDotenv } from "dotenv";

// Populate process.env for the Playwright host process (bunx does not auto-load
// .env.test even when NODE_ENV=test, because dotenv is only triggered by `bun run`).
loadDotenv({ path: ".env.test", override: false, quiet: true });
loadDotenv({ path: ".env", override: false, quiet: true });

import { defineConfig } from "@playwright/test";

export default defineConfig({
  globalSetup: "./__tests__/e2e/global-setup.ts",
  testDir: "./__tests__/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    // Collapses the app's view transitions to 0s (globals.css honors
    // prefers-reduced-motion), so route-content double-mount windows don't race
    // post-navigation assertions. See narrators/editors/studios dark-mode specs.
    reducedMotion: "reduce",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
