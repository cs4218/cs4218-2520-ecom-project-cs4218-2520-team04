// Tan Wei Lian, A0269750U
//
// Auth setup for Playwright E2E tests.
// Logs in as the shared admin test account and persists the browser storage
// state to playwright/.auth.json so all downstream tests start authenticated.

import { test as setup, expect } from "@playwright/test";
import path from "path";

// Path is resolved relative to the project root (where playwright is run from)
const authFile = path.join("playwright", ".auth.json");

// Tan Wei Lian, A0269750U
setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");

  await page.getByPlaceholder("Enter Your Email ").fill("test@admin.com");
  await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
  await page.getByRole("button", { name: "LOGIN" }).click();

  // Wait for successful redirect to home before saving state
  await page.waitForURL("/");
  await expect(page).toHaveURL("/");

  await page.context().storageState({ path: authFile });
});
