/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * UI tests for client/src/pages/Pagenotfound.js (any invalid URL → 404)
 *
 * 404 Page Test Coverage
 * 1. Functional end-to-end (E2E): renders for invalid URLs, return home link works
 * 2. User interface: 404 message visible, Header/Footer present, no overflow
 * 3. Regression: back navigation returns to previous page, valid URL loads after 404
 *
 * auth state doesnt matter as all users have the same view
 *
 * Note: PageNotFound renders when React Router has no matching route — the
 * server returns the CRA index.html (200) and React handles the 404 display
 * client-side. The page is not a real HTTP 404 response.
 * 
 * Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
 */

import { test, expect } from "@playwright/test";

// user state doesnt matter
test.use({ storageState: { cookies: [], origins: [] } });

// user flows
test.describe("Functional end-to-end (E2E)", () => {
    test("navigate to an invalid URL and render the 404 page without crashing", async ({ page }) => {
        await page.goto("/this-does-not-exist");
        await expect(page.locator("body")).not.toBeEmpty();
        await expect(page.locator("nav")).toBeVisible();
    });

    test("multiple different invalid URLs all resolves to the 404 page", async ({ page }) => {
        const invalidRoutes = ["/invalid-route", "/does-not-exist", "/abc/xyz/123"];
        for (const route of invalidRoutes) {
            await page.goto(route);
            const body = await page.locator("body").textContent();
            const has404 =
                body?.includes("404") ||
                body?.toLowerCase().includes("not found");
            expect(has404).toBe(true);
        }
    });

    test("clicking the return home link navigates back to /", async ({ page }) => {
        await page.goto("/invalid-route");
        const homeLink = page.locator("a[href='/']").first();
        await expect(homeLink).toBeVisible();
        await homeLink.click();
        await expect(page).toHaveURL("/");
    });
});

// user elements
test.describe("User interface", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/invalid-route");
    });

    test("404 message is clearly visible on the page", async ({ page }) => {
        const body = await page.locator("body").textContent();
        const has404 =
            body?.includes("404") ||
            body?.toLowerCase().includes("not found");
        expect(has404).toBe(true);
    });

    test("a link to return to the home page is present", async ({ page }) => {
        await expect(page.locator("a[href='/']").first()).toBeVisible();
    });

    test("Header is present on the 404 page", async ({ page }) => {
        await expect(page.locator("nav")).toBeVisible();
    });

    test("Footer is present on the 404 page", async ({ page }) => {
        await expect(page.locator("div.footer")).toBeVisible();
    });

    test("404 content does not cause horizontal overflow", async ({ page }) => {
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = page.viewportSize()?.width ?? 1280;
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
    });
});

// regression testing
test.describe("PageNotFound — Regression", () => {
    test("clicking back from 404 returns to the previous valid page", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.goto("/invalid-route");
        await page.goBack();
        await expect(page).toHaveURL("/");
    });

    test("typing a valid URL after landing on 404 loads the correct page", async ({ page }) => {
        await page.goto("/invalid-route");
        await page.goto("/about");
        await expect(page).toHaveURL("/about");
        await expect(page.locator("nav")).toBeVisible();
    });
});