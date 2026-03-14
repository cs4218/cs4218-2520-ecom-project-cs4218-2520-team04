// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * Playwright config for Tan Wei Lian, A0269750U — UI (E2E) tests.
 * Backend: http://localhost:6060  (node server.js, PORT=6060)
 * Client:  http://localhost:3000  (CRA dev server, proxies /api/* to 6060)
 */
module.exports = defineConfig({
  globalSetup: "./tests/ui/global-setup.js",
  globalTeardown: "./tests/ui/global-teardown.js",
  testDir: "./tests/ui",
  /* Serial execution keeps CRUD state consistent across dependent tests */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  timeout: 60 * 1000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    ignoreHTTPSErrors: true,
  },

  projects: [
    // Phase 1 — save admin auth to playwright/.auth.json
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.js/,
    },
    // Phase 2 — all tests run with admin session
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth.json",
      },
      dependencies: ["auth-setup"],
    },
  ],

  // Reuse running servers locally; spin up fresh ones on CI
  webServer: [
    {
      command: "npm start --prefix ./client",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: "node server.js",
      url: "http://localhost:6060",
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
    },
  ],
});
