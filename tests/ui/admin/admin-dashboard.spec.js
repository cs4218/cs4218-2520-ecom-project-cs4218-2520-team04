//
//  Mervyn Teo Zi Yan, A0273039A
//
// E2E tests: Admin dashboard flows spanning multiple components
//
// Each test is a complete user journey:
//  1. Admin navigates to dashboard → views info → navigates to Create Category page → sees category form
//  2. Admin navigates to dashboard → clicks Products → sees product list → clicks a product
//  3. Admin navigates to dashboard → clicks Orders → sees orders table
//  4. Non-admin user tries to access admin dashboard → blocked/redirected
//  5. Unauthenticated user tries to access admin dashboard → redirected to login → login → access dashboard
//

import { test, expect } from "@playwright/test";
import path from "path";

const adminAuthFile = path.join("playwright", ".auth.json");
const userAuthFile = path.join("playwright", ".user.auth.json");

const DASHBOARD_ROUTE = "/dashboard/admin";

// ── Admin E2E flows ──────────────────────────────────────────────────────────
test.describe("E2E: Admin dashboard workflows", () => {
  test.use({ storageState: adminAuthFile });

  test("admin views dashboard info then navigates to Create Category page", async ({
    page,
  }) => {
    // 1. Navigate to admin dashboard
    await page.goto(DASHBOARD_ROUTE);

    // 2. Verify admin details are displayed
    await expect(page.getByText(/admin name/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/admin email/i)).toBeVisible();
    await expect(page.getByText(/admin contact/i)).toBeVisible();

    // 3. Admin panel menu should be visible
    await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible();

    // 4. Click "Create Category" in the admin menu
    await page.locator(".dashboard-menu").getByRole("link", { name: /create category/i }).click();

    // 5. Should navigate to create-category page and see the category form
    await page.waitForURL("**/dashboard/admin/create-category", { timeout: 5000 });
    await expect(page.getByRole("heading", { name: /manage category/i })).toBeVisible({ timeout: 5000 });
  });

  test("admin views dashboard then navigates to Products page and sees product list", async ({
    page,
  }) => {
    // 1. Navigate to admin dashboard
    await page.goto(DASHBOARD_ROUTE);
    await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible({ timeout: 5000 });

    // 2. Click "Products" in the admin menu
    await page.locator(".dashboard-menu").getByRole("link", { name: /^products$/i }).click();

    // 3. Should navigate to products page
    await page.waitForURL("**/dashboard/admin/products", { timeout: 5000 });

    // 4. Should see the products list heading and at least one product card (from seeded data)
    await expect(page.getByRole("heading", { name: /all products list/i })).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".card").first()).toBeVisible({ timeout: 5000 });
  });

  test("admin navigates from dashboard to Orders page and sees order list", async ({
    page,
  }) => {
    // 1. Navigate to admin dashboard
    await page.goto(DASHBOARD_ROUTE);
    await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible({ timeout: 5000 });

    // 2. Click "Orders" in the admin menu
    await page.locator(".dashboard-menu").getByRole("link", { name: /^orders$/i }).click();

    // 3. Should navigate to orders page
    await page.waitForURL("**/dashboard/admin/orders", { timeout: 5000 });

    // 4. Should see the "All Orders" heading
    await expect(page.getByRole("heading", { name: /all orders/i })).toBeVisible({ timeout: 5000 });
  });

  test("admin navigates from dashboard to Users page and sees user list", async ({
    page,
  }) => {
    // 1. Navigate to admin dashboard
    await page.goto(DASHBOARD_ROUTE);
    await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible({ timeout: 5000 });

    // 2. Click "Users" in the admin menu
    await page.locator(".dashboard-menu").getByRole("link", { name: /^users$/i }).click();

    // 3. Should navigate to users page
    await page.waitForURL("**/dashboard/admin/users", { timeout: 5000 });

    // 4. Should see at least one user in the list (the test admin at minimum)
    await expect(page.getByText(/test@admin.com/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("admin dashboard card shows actual non-empty values from the logged-in admin", async ({
    page,
  }) => {
    // 1. Navigate to admin dashboard
    await page.goto(DASHBOARD_ROUTE);

    // 2. Each <h3> renders "Admin Name : <value>" — assert a non-empty value follows the colon
    const nameHeading = page.locator(".card h3").nth(0);
    const emailHeading = page.locator(".card h3").nth(1);
    const phoneHeading = page.locator(".card h3").nth(2);

    await expect(nameHeading).toHaveText(/Admin Name\s*:\s*\S+/);
    await expect(emailHeading).toHaveText(/Admin Email\s*:\s*\S+/);
    await expect(phoneHeading).toHaveText(/Admin Contact\s*:\s*\S+/);
  });

  test("admin navigates dashboard → Create Product page → sees product form", async ({
    page,
  }) => {
    // 1. Navigate to admin dashboard
    await page.goto(DASHBOARD_ROUTE);
    await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible({ timeout: 5000 });

    // 2. Click "Create Product" in the admin menu
    await page.locator(".dashboard-menu").getByRole("link", { name: /create product/i }).click();

    // 3. Should navigate to create-product page
    await page.waitForURL("**/dashboard/admin/create-product", { timeout: 5000 });

    // 4. Should see the create product form heading
    await expect(page.getByRole("heading", { name: /create product/i })).toBeVisible({ timeout: 5000 });
  });
});

// ── Access control flows ────────────────────────────────────────────────────
test.describe("E2E: Admin dashboard access control", () => {
  test("non-admin user cannot access admin dashboard and is blocked", async ({ browser }) => {
    const context = await browser.newContext({ storageState: userAuthFile });
    const page = await context.newPage();

    // 1. Try to access admin dashboard as a regular user
    await page.goto(DASHBOARD_ROUTE);

    // 2. Should be redirected away or not see admin content (spinner → redirect)
    await page.waitForTimeout(4500);

    const redirectedAway = !page.url().includes(DASHBOARD_ROUTE);
    const panelVisible = await page
      .getByRole("heading", { name: /admin panel/i })
      .isVisible()
      .catch(() => false);

    expect(redirectedAway || !panelVisible).toBeTruthy();

    await context.close();
  });

  test("unauthenticated user is redirected from admin dashboard, then can login to access it", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    // 1. Try to visit admin dashboard without auth
    await page.goto(DASHBOARD_ROUTE);

    // 2. Should be redirected away (spinner then redirect)
    await page
      .waitForURL((url) => !url.toString().includes(DASHBOARD_ROUTE), { timeout: 10000 })
      .catch(() => {});
    expect(page.url()).not.toContain(DASHBOARD_ROUTE);

    // 3. Navigate to login and authenticate
    await page.goto("/login");
    await page.getByPlaceholder("Enter Your Email").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
    await page.getByRole("button", { name: /^login$/i }).click();
    await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 10000 });

    // 4. Now admin dashboard should be accessible
    await page.goto(DASHBOARD_ROUTE);
    await expect(page.getByText(/admin name/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible();

    await context.close();
  });
});
