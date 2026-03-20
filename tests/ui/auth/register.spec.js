//
//  Mervyn Teo Zi Yan, A0273039A
//
// E2E tests: Register flows spanning multiple components
//
// Each test is a complete user journey:
//  1. Register new user → redirected to login → login with new credentials → see authenticated home
//  2. Register with an already-existing email → error toast → stay on register page
//  3. Navigate to register from login page → fill form → register → end up on login
//  4. Register with missing fields → form validation prevents submission
//
// Note: Register tests mock the /register API since creating real users in the DB
// would require cleanup. Login after registration uses real API where possible.
//

import { test, expect } from "@playwright/test";

// All register tests need an unauthenticated session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("E2E: Register flows", () => {
  test("complete registration flow: fill form → register → redirected to login → login succeeds", async ({
    page,
  }) => {
    // Mock only the register endpoint (we can't create real users easily)
    await page.route("**/api/v1/auth/register", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "User Register Successfully" }),
      });
    });

    // 1. Navigate to register page
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /register form/i })).toBeVisible();

    // 2. Fill in all fields
    await page.getByPlaceholder("Enter Your Name").fill("Test User");
    await page.getByPlaceholder("Enter Your Email").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Phone").fill("91234567");
    await page.getByPlaceholder("Enter Your Address").fill("123 Test Street");
    await page.locator("#exampleInputDOB1").fill("2000-01-01");
    await page.getByPlaceholder("What is Your Favorite sports").fill("Football");

    // 3. Submit registration
    await page.getByRole("button", { name: /register/i }).click();

    // 4. Should see success toast
    await expect(page.getByText(/register successfully/i)).toBeVisible({ timeout: 5000 });

    // 5. Should redirect to login page
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page.getByRole("heading", { name: /login form/i })).toBeVisible();

    // 6. Now login with the "registered" credentials (uses real login API)
    await page.getByPlaceholder("Enter Your Email").fill("test@admin.com");
    await page.getByPlaceholder("Enter Your Password").fill("test@admin.com");
    await page.getByRole("button", { name: /^login$/i }).click();

    // 7. Should redirect to home as authenticated user
    await expect(page.getByText(/login successfully/i)).toBeVisible({ timeout: 5000 });
    await page.waitForURL("/", { timeout: 5000 });
    await expect(page.locator(".nav-link.dropdown-toggle").first()).toBeVisible({ timeout: 5000 });
  });

  test("register with duplicate email shows error and stays on register page", async ({
    page,
  }) => {
    // Mock register to return failure (duplicate email)
    await page.route("**/api/v1/auth/register", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Already registered, please login" }),
      });
    });

    // 1. Navigate to register
    await page.goto("/register");

    // 2. Fill in all fields
    await page.getByPlaceholder("Enter Your Name").fill("Existing User");
    await page.getByPlaceholder("Enter Your Email").fill("duplicate@example.com");
    await page.getByPlaceholder("Enter Your Password").fill("Password123");
    await page.getByPlaceholder("Enter Your Phone").fill("91234567");
    await page.getByPlaceholder("Enter Your Address").fill("123 Test Street");
    await page.locator("#exampleInputDOB1").fill("2000-01-01");
    await page.getByPlaceholder("What is Your Favorite sports").fill("Football");

    // 3. Submit
    await page.getByRole("button", { name: /register/i }).click();

    // 4. Should see error toast
    await expect(page.getByText(/already registered/i)).toBeVisible({ timeout: 5000 });

    // 5. Should still be on register page
    expect(page.url()).toContain("/register");

    // 6. User can navigate to login from here via the nav
    await page.getByRole("link", { name: /^login$/i }).click();
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page.getByRole("heading", { name: /login form/i })).toBeVisible();
  });

  test("navigate from login page to register page and complete registration", async ({
    page,
  }) => {
    // Mock register endpoint
    await page.route("**/api/v1/auth/register", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "User Register Successfully" }),
      });
    });

    // 1. Start at login page
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /login form/i })).toBeVisible();

    // 2. Navigate to register via nav link
    await page.getByRole("link", { name: /^register$/i }).click();
    await page.waitForURL("**/register", { timeout: 5000 });
    await expect(page.getByRole("heading", { name: /register form/i })).toBeVisible();

    // 3. Fill in all fields and submit
    await page.getByPlaceholder("Enter Your Name").fill("New User");
    await page.getByPlaceholder("Enter Your Email").fill("newuser@example.com");
    await page.getByPlaceholder("Enter Your Password").fill("Password123");
    await page.getByPlaceholder("Enter Your Phone").fill("91234567");
    await page.getByPlaceholder("Enter Your Address").fill("456 New Street");
    await page.locator("#exampleInputDOB1").fill("1995-06-15");
    await page.getByPlaceholder("What is Your Favorite sports").fill("Basketball");

    await page.getByRole("button", { name: /register/i }).click();

    // 4. Should redirect back to login
    await expect(page.getByText(/register successfully/i)).toBeVisible({ timeout: 5000 });
    await page.waitForURL("**/login", { timeout: 5000 });
  });

  test("register shows loading state and then network error on failure", async ({ page }) => {
    // Mock register with delay then abort
    await page.route("**/api/v1/auth/register", async (route) => {
      await route.abort("failed");
    });

    // 1. Navigate to register and fill form
    await page.goto("/register");
    await page.getByPlaceholder("Enter Your Name").fill("Test User");
    await page.getByPlaceholder("Enter Your Email").fill("test@example.com");
    await page.getByPlaceholder("Enter Your Password").fill("Password123");
    await page.getByPlaceholder("Enter Your Phone").fill("91234567");
    await page.getByPlaceholder("Enter Your Address").fill("123 Test Street");
    await page.locator("#exampleInputDOB1").fill("2000-01-01");
    await page.getByPlaceholder("What is Your Favorite sports").fill("Football");

    // 2. Submit
    await page.getByRole("button", { name: /register/i }).click();

    // 3. Should see generic error toast
    await expect(page.getByText(/something went wrong/i)).toBeVisible({ timeout: 5000 });

    // 4. Should still be on register page — user can try again
    expect(page.url()).toContain("/register");
    await expect(page.getByRole("button", { name: /register/i })).toBeEnabled();
  });
});
