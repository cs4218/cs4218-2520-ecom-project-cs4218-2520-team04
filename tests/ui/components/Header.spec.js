/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * UI tests for client/src/components/Header.js
 *
 * Header UI Test Coverage:
 * 1. Functional end-to-end (E2E): navigation, auth flow, logout, role-based links
 * 2. User interface: visibility of all header elements
 * 3. Regression: session persistence on refresh, back navigation, cart count persistence
 *
 * Auth setup (from setup files)
 * ─────────────────────────────
 * Admin user:   test@admin.com  / test@admin.com  → playwright/.auth.json
 * Normal user:  user@test.com   / user@test.com   → playwright/.user.auth.json
 *
 * All tests default to admin storageState (set at project level in playwright.config.js).
 * Unauthenticated tests override storageState to empty via test.use().
 * Normal user tests override storageState to playwright/.user.auth.json via test.use().
 * Admin-specific tests override storageState to playwright/.auth.json explicitly
 * so they always run with admin credentials regardless of project.
 *
 * Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
 */

import { test, expect } from "@playwright/test";

// helpers

// Categories dropdown menu 
const getCategoriesMenu = (page) =>
    page.locator("li.nav-item.dropdown:has(a[href='/categories']) ul.dropdown-menu");

// User/auth dropdown toggle
const getUserDropdownToggle = (page) =>
    page.locator("li.nav-item.dropdown:not(:has(a[href='/categories'])) a.dropdown-toggle");

// user flows
test.describe("Functional E2E", () => {

    // set storageState to auth so that tests always run as admin
    test.describe("Admin session", () => {
        test.use({ storageState: "playwright/.auth.json" });

        test("brand name link navigates to the home page", async ({ page }) => {
            await page.goto("/about");
            await page.click("a.navbar-brand");
            await expect(page).toHaveURL("/");
        });

        test("Home link navigates to /", async ({ page }) => {
            await page.goto("/about");
            await page.click("a.nav-link[href='/']");
            await expect(page).toHaveURL("/");
        });

        test("Categories dropdown opens when clicked and shows category items", async ({ page }) => {
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await page.click("a.dropdown-toggle[href='/categories']");
            const categoriesMenu = getCategoriesMenu(page);
            await expect(categoriesMenu).toBeVisible();
            await expect(
                categoriesMenu.locator("a.dropdown-item:has-text('All Categories')")
            ).toBeVisible();
        });

        test("clicking a category item navigates to /category/:slug", async ({ page }) => {
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await page.click("a.dropdown-toggle[href='/categories']");
            const categoriesMenu = getCategoriesMenu(page);
            // nth(1) skips "All Categories" at index 0 to get the first real category
            const firstCategory = categoriesMenu.locator("a.dropdown-item").nth(1);
            if (await firstCategory.count() === 0) return test.skip();
            const href = await firstCategory.getAttribute("href");
            await firstCategory.click();
            await expect(page).toHaveURL(href);
        });

        test("search bar accepts text input and submitting navigates to search results", async ({ page }) => {
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await page.fill("input[placeholder='Search']", "laptop");
            await page.click("button.btn-outline-success");
            await expect(page).toHaveURL(/\/search/);
        });

        test("admin user sees Dashboard link pointing to /dashboard/admin", async ({ page }) => {
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await getUserDropdownToggle(page).click();
            await expect(page.locator("a[href='/dashboard/admin']")).toBeVisible();
        });

        test("admin user does not see /dashboard/user link", async ({ page }) => {
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await getUserDropdownToggle(page).click();
            await expect(page.locator("a[href='/dashboard/user']")).not.toBeVisible();
        });

        test("clicking Logout clears the session and shows Login and Register links", async ({ page }) => {
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await getUserDropdownToggle(page).click();
            await page.getByText(/logout/i).click();
            await expect(page.locator("a[href='/login']")).toBeVisible();
            await expect(page.locator("a[href='/register']")).toBeVisible();
        });
    });

    // empty storageState to represent no logged-in user
    test.describe("Unauthenticated state", () => {
        test.use({ storageState: { cookies: [], origins: [] } });

        test("Login and Register links are visible when not authenticated", async ({ page }) => {
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await expect(page.locator("a[href='/login']")).toBeVisible();
            await expect(page.locator("a[href='/register']")).toBeVisible();
        });

        test("Logout option is NOT visible when not authenticated", async ({ page }) => {
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await expect(page.getByText(/logout/i)).not.toBeVisible();
        });

        test("clicking Login navigates to /login", async ({ page }) => {
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await page.click("a[href='/login']");
            await expect(page).toHaveURL(/\/login/);
        });

        test("clicking Register navigates to /register", async ({ page }) => {
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await page.click("a[href='/register']");
            await expect(page).toHaveURL(/\/register/);
        });
    });

    test.describe("Normal user role", () => {
        test.use({ storageState: "playwright/.user.auth.json" });

        test("normal user sees Dashboard link pointing to /dashboard/user", async ({ page }) => {
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await getUserDropdownToggle(page).click();
            await expect(page.locator("a[href='/dashboard/user']")).toBeVisible();
        });

        test("normal user does not see /dashboard/admin link", async ({ page }) => {
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await getUserDropdownToggle(page).click();
            await expect(page.locator("a[href='/dashboard/admin']")).not.toBeVisible();
        });
    });
});

// ui elements that users see
test.describe("User interface", () => {
    test.use({ storageState: "playwright/.auth.json" });

    test.beforeEach(async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
    });

    test("brand name 'Virtual Vault' is visible in the navbar", async ({ page }) => {
        await expect(page.locator("a.navbar-brand")).toBeVisible();
        await expect(page.locator("a.navbar-brand")).toContainText("Virtual Vault");
    });

    test("brand name link has href pointing to /", async ({ page }) => {
        await expect(page.locator("a.navbar-brand")).toHaveAttribute("href", "/");
    });

    test("Categories dropdown toggle is visible in the navbar", async ({ page }) => {
        await expect(page.locator("a.dropdown-toggle[href='/categories']")).toBeVisible();
    });

    test("search input, button and form are all visible", async ({ page }) => {
        await expect(page.locator("input[placeholder='Search']")).toBeVisible();
        await expect(page.locator("button.btn-outline-success")).toBeVisible();
        await expect(page.locator("form[role='search']")).toBeVisible();
    });

    test("Cart link pointing to /cart is visible", async ({ page }) => {
        await expect(page.locator("a[href='/cart']")).toBeVisible();
    });

    test("cart badge is visible with initial count of 0 when cart is empty", async ({ page }) => {
        const badge = page.locator("sup.ant-badge-count");
        await expect(badge).toBeVisible();
        await expect(badge).toHaveAttribute("title", "0");
    });

    test("Login and Register are NOT visible when admin is logged in", async ({ page }) => {
        await expect(page.locator("a[href='/login']")).not.toBeVisible();
        await expect(page.locator("a[href='/register']")).not.toBeVisible();
    });

    test("cart badge count updates after adding a product to cart", async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem(
                "cart",
                JSON.stringify([{ _id: "p1", name: "Test Product", price: 10 }])
            );
        });
        await page.reload();
        const badge = page.locator("sup.ant-badge-count");
        await expect(badge).not.toHaveAttribute("title", "0");
    });
});

// regression testing
test.describe("Regression", () => {
    test.use({ storageState: "playwright/.auth.json" });

    test("after logout, navigating back does not restore the authenticated session", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await getUserDropdownToggle(page).click();
        await page.getByText(/logout/i).click();
        await expect(page.locator("a[href='/login']")).toBeVisible();
        await page.goBack({ waitUntil: "domcontentloaded" });
        // Session should still be cleared after pressing back
        await expect(page.locator("a[href='/login']")).toBeVisible();
    });

    test("refreshing the page while logged in keeps the user authenticated", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page.locator("a[href='/login']")).not.toBeVisible();
        await page.reload();
        // Should still be logged in after refresh
        await expect(page.locator("a[href='/login']")).not.toBeVisible();
    });

    test("cart badge count persists correctly after a page refresh", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.evaluate(() => {
            localStorage.setItem(
                "cart",
                JSON.stringify([{ _id: "p1", name: "Test", price: 10 }])
            );
        });
        await page.reload();
        const badge = page.locator("sup.ant-badge-count");
        await expect(badge).toHaveAttribute("title", "1");
    });

    test("Header renders correctly after navigating between multiple pages", async ({ page }) => {
        const routes = ["/", "/about", "/contact", "/policy"];
        for (const route of routes) {
            await page.goto(route, {
                waitUntil: route === "/" ? "domcontentloaded" : "load"
            });            
            await expect(page.locator("nav")).toBeVisible();
            await expect(page.locator("a.navbar-brand")).toBeVisible();
        }
    });
});