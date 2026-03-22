// Tan Wei Lian, A0269750U
//
// Auth setup for Playwright E2E tests.
// Logs in as the shared admin test account and persists the browser storage
// state to playwright/.auth.json so all downstream tests start authenticated.

import { test as setup, expect } from "@playwright/test";
import path from "path";
import { seedPlaywrightAdminUser } from "./seedTestUsers.js";

// Path is resolved relative to the project root (where playwright is run from)
const authFile = path.join("playwright", ".auth.json");

// Tan Wei Lian, A0269750U
setup("authenticate as admin", async ({ page }) => {
  await seedPlaywrightAdminUser();

  await page.goto("/login");

  await page.getByPlaceholder("Enter Your Email ").fill("test@admin.com");
  await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
  await page.getByRole("button", { name: "LOGIN" }).click();

  // Wait for successful redirect to home before saving state.
  // Staying on /login usually means the backend is pointed at the wrong DB
  // or the seeded credentials were rejected.
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), {
    timeout: 15000,
  });
  await expect(page).toHaveURL("/");

  await page.context().storageState({ path: authFile });
});
