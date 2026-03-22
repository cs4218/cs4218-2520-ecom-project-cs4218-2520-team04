//
//  Mervyn Teo Zi Yan, A0273039A
//
// E2E tests: AdminMenu component across admin pages
//
// Each test is a complete user journey:
//  1. Admin menu renders all navigation links on the admin dashboard
//  2. Admin menu links navigate to the correct pages
//  3. Admin menu highlights the active link for the current page
//  4. Admin menu is consistently rendered across all admin sub-pages
//  5. Non-admin user does not see the admin menu
//

import { test, expect } from "@playwright/test";
import path from "path";

const adminAuthFile = path.join("playwright", ".auth.json");
const userAuthFile = path.join("playwright", ".user.auth.json");

const DASHBOARD_ROUTE = "/dashboard/admin";

const MENU_LINKS = [
  { name: "Create Category", path: "/dashboard/admin/create-category" },
  { name: "Create Product", path: "/dashboard/admin/create-product" },
  { name: "Products", path: "/dashboard/admin/products" },
  { name: "Orders", path: "/dashboard/admin/orders" },
  { name: "Users", path: "/dashboard/admin/users" },
];

// ── Admin menu rendering and navigation ─────────────────────────────────────
test.describe("E2E: AdminMenu component", () => {
  test.use({ storageState: adminAuthFile });

  test("admin menu displays heading and all five navigation links on dashboard", async ({
    page,
  }) => {
    // 1. Navigate to admin dashboard
    await page.goto(DASHBOARD_ROUTE);

    // 2. Admin Panel heading should be visible
    await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible({ timeout: 5000 });

    // 3. All five menu links should be visible inside the dashboard-menu
    const menu = page.locator(".dashboard-menu");
    for (const link of MENU_LINKS) {
      await expect(menu.getByRole("link", { name: link.name })).toBeVisible();
    }
  });

  test("each admin menu link navigates to the correct page", async ({
    page,
  }) => {
    await page.goto(DASHBOARD_ROUTE);
    await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible({ timeout: 5000 });

    const menu = page.locator(".dashboard-menu");

    for (const link of MENU_LINKS) {
      // Click the menu link
      await menu.getByRole("link", { name: link.name }).click();

      // Verify URL changed to the expected path
      await page.waitForURL(`**${link.path}`, { timeout: 5000 });
      expect(page.url()).toContain(link.path);

      // Admin menu should still be visible after navigation
      await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible();
    }
  });

  test("active menu link gets the 'active' class on the current page", async ({
    page,
  }) => {
    for (const link of MENU_LINKS) {
      // Navigate directly to each admin sub-page
      await page.goto(link.path);
      await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible({ timeout: 5000 });

      // The corresponding menu link should have the 'active' class
      const menuLink = page.locator(".dashboard-menu").getByRole("link", { name: link.name });
      await expect(menuLink).toHaveClass(/active/);
    }
  });

  test("admin menu is consistently rendered across all admin sub-pages", async ({
    page,
  }) => {
    const adminPages = [
      DASHBOARD_ROUTE,
      ...MENU_LINKS.map((l) => l.path),
    ];

    for (const pagePath of adminPages) {
      await page.goto(pagePath);

      // Admin Panel heading should be present on every admin page
      await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible({ timeout: 5000 });

      // All five links should be present on every admin page
      const menu = page.locator(".dashboard-menu");
      for (const link of MENU_LINKS) {
        await expect(menu.getByRole("link", { name: link.name })).toBeVisible();
      }
    }
  });

  test("admin menu links have correct href attributes", async ({
    page,
  }) => {
    await page.goto(DASHBOARD_ROUTE);
    await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible({ timeout: 5000 });

    const menu = page.locator(".dashboard-menu");

    for (const link of MENU_LINKS) {
      const menuLink = menu.getByRole("link", { name: link.name });
      await expect(menuLink).toHaveAttribute("href", link.path);
    }
  });
});

// ── Access control ──────────────────────────────────────────────────────────
test.describe("E2E: AdminMenu access control", () => {
  test("non-admin user does not see the admin menu on the dashboard", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: userAuthFile });
    const page = await context.newPage();

    // 1. Try to access admin dashboard as a regular user
    await page.goto(DASHBOARD_ROUTE);

    // 2. Wait for redirect or content to settle
    await page.waitForTimeout(4500);

    // 3. Admin menu should not be visible
    const menuVisible = await page
      .locator(".dashboard-menu")
      .isVisible()
      .catch(() => false);

    // Either redirected away from admin dashboard, or menu is not rendered
    const redirectedAway = !page.url().includes(DASHBOARD_ROUTE);
    expect(redirectedAway || !menuVisible).toBeTruthy();

    await context.close();
  });

  test("unauthenticated user does not see the admin menu", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    // 1. Try to access admin dashboard without auth
    await page.goto(DASHBOARD_ROUTE);

    // 2. Should be redirected away
    await page
      .waitForURL((url) => !url.toString().includes(DASHBOARD_ROUTE), { timeout: 10000 })
      .catch(() => {});

    // 3. Admin menu should not be visible
    const menuVisible = await page
      .locator(".dashboard-menu")
      .isVisible()
      .catch(() => false);

    const redirectedAway = !page.url().includes(DASHBOARD_ROUTE);
    expect(redirectedAway || !menuVisible).toBeTruthy();

    await context.close();
  });
});
