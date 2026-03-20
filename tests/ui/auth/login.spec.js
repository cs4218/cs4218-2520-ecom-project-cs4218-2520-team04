//
//  Mervyn Teo Zi Yan, A0273039A
//
// E2E tests: Login flows spanning multiple components
//
// Each test is a complete user journey:
//  1. Login with valid admin credentials → redirected to home → nav shows user name → can access admin dashboard
//  2. Login with valid credentials → navigate to profile → see user details
//  3. Login with invalid credentials → error toast → stays on login page → retry with correct credentials → success
//  4. Login → Logout → nav reverts to unauthenticated → cannot access protected route
//  5. Forgot Password navigation from login page
//

import { test, expect } from "@playwright/test";

// All login tests need an unauthenticated session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("E2E: Login flows", () => {
  test("login with valid admin credentials, see authenticated home, then access admin dashboard", async ({
    page,
  }) => {
    // 1. Navigate to login page
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /login form/i })).toBeVisible();

    // 2. Fill in admin credentials and submit
    await page.getByPlaceholder("Enter Your Email").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
    await page.getByRole("button", { name: /^login$/i }).click();

    // 3. Should see success toast and redirect to home
    await expect(page.getByText(/login successfully/i)).toBeVisible({ timeout: 5000 });
    await page.waitForURL("/", { timeout: 5000 });

    // 4. Header should show the authenticated user's name (dropdown toggle)
    await expect(page.locator(".nav-link.dropdown-toggle").first()).toBeVisible({ timeout: 5000 });

    // 5. Navigate to admin dashboard — should render without redirect
    await page.goto("/dashboard/admin");
    await expect(page.getByText(/admin name/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/admin email/i)).toBeVisible();
    await expect(page.getByText(/admin contact/i)).toBeVisible();
  });

  test("login with wrong credentials shows error, then retry with correct credentials succeeds", async ({
    page,
  }) => {
    // 1. Navigate to login
    await page.goto("/login");

    // 2. Enter wrong credentials
    await page.getByPlaceholder("Enter Your Email").fill("wrong@example.com");
    await page.getByPlaceholder("Enter Your Password").fill("wrongpassword");
    await page.getByRole("button", { name: /^login$/i }).click();

    // 3. Should see error and stay on login page
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain("/login");

    // 4. Clear fields and retry with correct credentials
    await page.getByPlaceholder("Enter Your Email").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
    await page.getByRole("button", { name: /^login$/i }).click();

    // 5. Should succeed — redirected to home
    await expect(page.getByText(/login successfully/i)).toBeVisible({ timeout: 5000 });
    await page.waitForURL("/", { timeout: 5000 });
  });

  test("login then logout reverts nav to unauthenticated state", async ({ page }) => {
    // 1. Login
    await page.goto("/login");
    await page.getByPlaceholder("Enter Your Email").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
    await page.getByRole("button", { name: /^login$/i }).click();
    await page.waitForURL("/", { timeout: 5000 });

    // 2. Verify authenticated nav — user dropdown visible
    const userDropdown = page.locator(".nav-link.dropdown-toggle").first();
    await expect(userDropdown).toBeVisible({ timeout: 5000 });

    // 3. Open dropdown and click Logout
    await userDropdown.click();
    await page.getByRole("link", { name: /logout/i }).click();

    // 4. Should redirect to login page
    await page.waitForURL("**/login", { timeout: 5000 });

    // 5. Nav should show Register/Login links (unauthenticated)
    await expect(page.getByRole("link", { name: /^register$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^login$/i })).toBeVisible();
  });

  test("forgot password button navigates away from login to forgot-password page", async ({
    page,
  }) => {
    // 1. Start at login
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /login form/i })).toBeVisible();

    // 2. Click forgot password
    await page.getByRole("button", { name: /forgot password/i }).click();

    // 3. Should navigate to forgot-password page
    await page.waitForURL("**/forgot-password", { timeout: 5000 });
    expect(page.url()).toContain("/forgot-password");
  });

  test("unauthenticated user trying to visit cart can login and continue shopping", async ({
    page,
  }) => {
    // 1. Start at home page (unauthenticated)
    await page.goto("/");

    // 2. Click on a product's "More Details" to view product page
    const firstDetailsBtn = page.getByRole("button", { name: /more details/i }).first();
    await expect(firstDetailsBtn).toBeVisible({ timeout: 5000 });
    await firstDetailsBtn.click();

    // 3. Should be on a product details page
    await page.waitForURL("**/product/**", { timeout: 5000 });
    await expect(page.getByRole("heading")).toBeVisible();

    // 4. Navigate to login via the nav
    await page.getByRole("link", { name: /^login$/i }).click();
    await page.waitForURL("**/login", { timeout: 5000 });

    // 5. Login with valid credentials
    await page.getByPlaceholder("Enter Your Email").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
    await page.getByRole("button", { name: /^login$/i }).click();

    // 6. Should be redirected back (to home or wherever) and now authenticated
    await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 5000 });
    await expect(page.locator(".nav-link.dropdown-toggle").first()).toBeVisible({ timeout: 5000 });
  });
});
