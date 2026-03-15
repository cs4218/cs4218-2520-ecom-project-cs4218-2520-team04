//
// Tan Wei Lian, A0269750U
//
// E2E UI tests for user private dashboard access control.
// Journeys:
//   1. Non-authenticated user visiting /dashboard/user is redirected to /login.
//   2. Authenticated user can access /dashboard/user and sees the profile card
//      with name, email, and the user menu links.
// Spans: PrivateRoute, Spinner, Layout, UserMenu, Dashboard.

import { test, expect } from "@playwright/test";

// ── Unauthenticated access ────────────────────────────────────────────────────

test.describe("User dashboard — unauthenticated access is blocked", () => {
  // Override the project's storageState so this describe runs without auth
  test.use({ storageState: { cookies: [], origins: [] } });

  test("non-auth user visiting /dashboard/user is shown the spinner and redirected to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard/user");

    // PrivateRoute renders Spinner while checking auth; auth token absent → redirect
    await expect(page.getByText(/redirecting to you in/i)).toBeVisible();

    // Spinner counts down 3 s then navigates to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ── Authenticated access ──────────────────────────────────────────────────────

test.describe("User dashboard — authenticated user sees profile and navigation", () => {
  // Inherits admin storageState from playwright.config.js (cs4218@test.com)

  test("authenticated user can access /dashboard/user and sees profile card", async ({
    page,
  }) => {
    await page.goto("/dashboard/user");
    await expect(page).toHaveURL("/dashboard/user");

    // Dashboard card shows the logged-in user's details
    // (The auth context provides name, email, address from localStorage)
    const card = page.locator(".card.w-75");
    await expect(card).toBeVisible();

    // At least name or email renders — confirms auth context flows into Dashboard
    const cardText = await card.textContent();
    expect(cardText?.length).toBeGreaterThan(0);
  });

  test("user menu links are visible on the dashboard: Profile and Orders", async ({
    page,
  }) => {
    await page.goto("/dashboard/user");
    await expect(page).toHaveURL("/dashboard/user");

    // UserMenu component renders sidebar navigation links
    await expect(page.getByRole("link", { name: /profile/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /orders/i })).toBeVisible();
  });

  test("authenticated user can navigate between dashboard sub-pages", async ({
    page,
  }) => {
    await page.goto("/dashboard/user");

    // Click "Profile" from the UserMenu — spans UserMenu + profile page
    await page.getByRole("link", { name: /profile/i }).click();
    await expect(page).toHaveURL("/dashboard/user/profile");

    // Navigate back to dashboard via Orders link
    await page.getByRole("link", { name: /orders/i }).click();
    await expect(page).toHaveURL("/dashboard/user/orders");
  });
});
