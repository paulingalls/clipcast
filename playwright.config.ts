import { defineConfig, devices } from "@playwright/test";

// Acceptance harness for the browser surface (marketing site served by Bun.serve at /).
// Playwright boots the real server via `webServer`, then drives a headless Chromium —
// what the test sees is exactly what a user's browser loads.
const PORT = 3101;

export default defineConfig({
  testDir: "./tests/acceptance/browser",
  // .pw.ts keeps these specs out of `bun test` (which matches .test/.spec).
  testMatch: "**/*.pw.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A dummy WALLET_ADDRESS satisfies the x402 prod-mode guard; the site at / is free.
    command: `WALLET_ADDRESS=0x000000000000000000000000000000000000dEaD PORT=${PORT} bun src/index.ts`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
