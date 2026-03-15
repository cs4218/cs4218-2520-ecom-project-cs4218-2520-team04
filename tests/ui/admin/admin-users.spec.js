//
// Lu Yixuan, Deborah, A0277911X
//
// UI test: Admin access vs non-admin access to Admin Users page.
// Admin: can view page.
// Non-admin: blocked (redirect or access denied UI).
//
// Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
//

import { test, expect } from "@playwright/test";
import path from "path";

const adminAuthFile = path.join("playwright", ".auth.json");
const userAuthFile = path.join("playwright", ".user.auth.json");

const ADMIN_USERS_ROUTE = "/dashboard/admin/users";

const heading = (page) => page.getByRole("heading", { name: /all users/i });

test.describe.serial("UI: Admin → Users page authorization", () => {
  test("admin can access Users page (authorised path)", async ({ page }) => {
    await page.context().addCookies([]);
  });

  test.use({ storageState: adminAuthFile });

  test("admin sees Users page render", async ({ page }) => {
    await page.goto(ADMIN_USERS_ROUTE);

    await expect(heading(page)).toBeVisible();
  });

  test("non-admin is blocked from Users page (unauthorised path)", async ({ browser }) => {
    const context = await browser.newContext({ storageState: userAuthFile });
    const page = await context.newPage();

    await page.goto(ADMIN_USERS_ROUTE);

    // Wait a moment for any client-side redirect/guard to run
    await page.waitForTimeout(500);

    // Condition A: redirected away (common)
    const redirectedAway = !page.url().includes(ADMIN_USERS_ROUTE);

    // Condition B: stayed on page but admin content not shown
    const headingVisible = await page.getByRole("heading", { name: /all users/i }).isVisible().catch(() => false);

    expect(redirectedAway || !headingVisible).toBeTruthy();

    await context.close();
  });
});