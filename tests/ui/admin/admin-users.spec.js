//
// Lu Yixuan, Deborah, A0277911X
//
// UI test: Admin access vs non-admin access to Admin Users page.
// Admin: can view page and sees Users table rendered (headers + rows/empty state).
// Non-admin: blocked (redirected away OR cannot see users table/heading).
//
// Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
//

import { test, expect } from "@playwright/test";
import path from "path";

const adminAuthFile = path.join("playwright", ".auth.json");
const userAuthFile = path.join("playwright", ".user.auth.json");

const ADMIN_USERS_ROUTE = "/dashboard/admin/users";

const heading = (page) => page.getByRole("heading", { name: /all users/i });
const usersTable = (page) => page.locator("table");
const emptyState = (page) => page.getByText(/No users found\./i);

test.describe.serial("UI: Admin → Users page authorization", () => {
  // ── Admin path ───────────────────────────────────────────────────────────
  test.describe("authorised admin", () => {
    test.use({ storageState: adminAuthFile });

    test("admin sees Users page render + table headers + rows/empty state", async ({ page }) => {
      await page.goto(ADMIN_USERS_ROUTE);

      await expect(heading(page)).toBeVisible();
      await expect(usersTable(page)).toBeVisible();

      // Validate column headers (stable even if users change)
      const headers = usersTable(page).locator("thead th");
      await expect(headers).toHaveCount(6);
      await expect(headers.nth(0)).toHaveText("#");
      await expect(headers.nth(1)).toHaveText("Name");
      await expect(headers.nth(2)).toHaveText("Email");
      await expect(headers.nth(3)).toHaveText("Role");
      await expect(headers.nth(4)).toHaveText("Phone");
      await expect(headers.nth(5)).toHaveText("Address");

      // Validate either rows exist OR empty message shown
      const rows = usersTable(page).locator("tbody tr");

      if (await emptyState(page).isVisible().catch(() => false)) {
        await expect(emptyState(page)).toBeVisible();
        await expect(rows).toHaveCount(0);
      } else {
        const rowCount = await rows.count();
        expect(rowCount).toBeGreaterThan(0);
      }
    });
  });

  // ── Non-admin path ───────────────────────────────────────────────────────
  test("non-admin is blocked from Users page (unauthorised path)", async ({ browser }) => {
    const context = await browser.newContext({ storageState: userAuthFile });
    const page = await context.newPage();

    await page.goto(ADMIN_USERS_ROUTE);

    // Allow client-side route guards to redirect
    await page.waitForTimeout(500);

    const redirectedAway = !page.url().includes(ADMIN_USERS_ROUTE);

    // If not redirected, assert admin content is not visible
    const headingVisible = await heading(page).isVisible().catch(() => false);
    const tableVisible = await usersTable(page).isVisible().catch(() => false);

    expect(redirectedAway || (!headingVisible && !tableVisible)).toBeTruthy();

    await context.close();
  });
});