//
//  Mervyn Teo Zi Yan, A0273039A
//
// E2E tests: Auth context behaviour across multiple components
//
// Each test is a complete user journey:
//  1. Login → refresh page → auth persists → still see admin dashboard
//  2. Login → logout → try to access admin dashboard → redirected away
//  3. Auth token is sent with API requests (login → navigate to protected route → API receives token)
//  4. Unauthenticated user visits protected route → spinner/redirect → lands on login → can login from there
//  5. Login → localStorage has auth → navigate between pages → auth maintained
//

import { test, expect } from "@playwright/test";

test.describe("E2E: Auth context persistence and protection", () => {
  test("auth state persists across page refresh: login → refresh → still on admin dashboard", async ({
    browser,
  }) => {
    // Use a clean context (no storageState)
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    // 1. Login
    await page.goto("/login");
    await page.getByPlaceholder("Enter Your Email").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
    await page.getByRole("button", { name: /^login$/i }).click();
    await page.waitForURL("/", { timeout: 5000 });

    // 2. Navigate to admin dashboard
    await page.goto("/dashboard/admin");
    await expect(page.getByText(/admin name/i)).toBeVisible({ timeout: 5000 });

    // 3. Refresh the page
    await page.reload();

    // 4. Auth should persist — dashboard should still render (not redirect)
    await expect(page.getByText(/admin name/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/admin email/i)).toBeVisible();

    await context.close();
  });

  test("after logout, user cannot access admin dashboard and is redirected", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    // 1. Login
    await page.goto("/login");
    await page.getByPlaceholder("Enter Your Email").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
    await page.getByRole("button", { name: /^login$/i }).click();
    await page.waitForURL("/", { timeout: 5000 });

    // 2. Verify auth is stored
    const authBefore = await page.evaluate(() => localStorage.getItem("auth"));
    expect(authBefore).not.toBeNull();

    // 3. Logout via nav dropdown
    const userDropdown = page.locator(".nav-link.dropdown-toggle").first();
    await expect(userDropdown).toBeVisible({ timeout: 5000 });
    await userDropdown.click();
    await page.getByRole("link", { name: /logout/i }).click();
    await page.waitForURL("**/login", { timeout: 5000 });

    // 4. Auth should be cleared from localStorage
    const authAfter = await page.evaluate(() => localStorage.getItem("auth"));
    expect(authAfter).toBeNull();

    // 5. Try to visit admin dashboard — should not render admin content
    await page.goto("/dashboard/admin");
    await page
      .waitForURL((url) => !url.toString().includes("/dashboard/admin"), { timeout: 10000 })
      .catch(() => {});

    // Either redirected away or admin panel not visible
    const isOnDashboard = page.url().includes("/dashboard/admin");
    if (isOnDashboard) {
      // If still on the URL, the admin content should not be rendered
      await expect(page.getByRole("heading", { name: /admin panel/i })).not.toBeVisible();
    }

    await context.close();
  });

  test("unauthenticated user visiting protected route is redirected, then can login to access it", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    // 1. Try to visit admin dashboard without auth
    await page.goto("/dashboard/admin");

    // 2. Should be redirected away (spinner shows then redirects to login)
    await page
      .waitForURL((url) => !url.toString().includes("/dashboard/admin"), { timeout: 10000 })
      .catch(() => {});
    expect(page.url()).not.toContain("/dashboard/admin");

    // 3. Navigate to login
    await page.goto("/login");
    await page.getByPlaceholder("Enter Your Email").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
    await page.getByRole("button", { name: /^login$/i }).click();
    await page.waitForURL("/", { timeout: 5000 });

    // 4. Now access admin dashboard — should work
    await page.goto("/dashboard/admin");
    await expect(page.getByText(/admin name/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible();

    await context.close();
  });

  test("axios Authorization header is set: admin API calls succeed after login", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    // Capture the Authorization header on admin-auth API calls
    let capturedAuthHeader = null;
    await page.route("**/api/v1/auth/admin-auth", async (route) => {
      capturedAuthHeader = route.request().headers()["authorization"];
      await route.continue();
    });

    // 1. Login
    await page.goto("/login");
    await page.getByPlaceholder("Enter Your Email").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
    await page.getByRole("button", { name: /^login$/i }).click();
    await page.waitForURL("/", { timeout: 5000 });

    // 2. Navigate to admin dashboard — triggers admin-auth API call
    await page.goto("/dashboard/admin");
    await expect(page.getByText(/admin name/i)).toBeVisible({ timeout: 5000 });

    // 3. Verify the Authorization header was sent with the token
    expect(capturedAuthHeader).toBeTruthy();

    await context.close();
  });

  test("auth is maintained while navigating between multiple pages", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    // 1. Login
    await page.goto("/login");
    await page.getByPlaceholder("Enter Your Email").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
    await page.getByRole("button", { name: /^login$/i }).click();
    await page.waitForURL("/", { timeout: 5000 });

    // 2. Navigate to home — should be authenticated
    await expect(page.locator(".nav-link.dropdown-toggle").first()).toBeVisible({ timeout: 5000 });

    // 3. Navigate to admin dashboard
    await page.goto("/dashboard/admin");
    await expect(page.getByText(/admin name/i)).toBeVisible({ timeout: 5000 });

    // 4. Navigate back to home page
    await page.getByRole("link", { name: /home/i }).click();
    await page.waitForURL("/", { timeout: 5000 });

    // 5. Still authenticated — user dropdown visible
    await expect(page.locator(".nav-link.dropdown-toggle").first()).toBeVisible({ timeout: 5000 });

    // 6. Navigate to cart page
    await page.getByRole("link", { name: /cart/i }).click();
    await page.waitForURL("**/cart", { timeout: 5000 });

    // 7. Still authenticated
    await expect(page.locator(".nav-link.dropdown-toggle").first()).toBeVisible({ timeout: 5000 });

    await context.close();
  });
});
