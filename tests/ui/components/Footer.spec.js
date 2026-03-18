/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * UI tests for client/src/components/Footer.js
 *
 * Footer UI test coverage
 * 1. Functional end-to-end (E2E): all three footer links navigate to correct pages
 * 2. User interface: copyright text, link visibility, no overlap with content
 * 3. Regression: footer renders consistently across pages and after auth changes
 *
 * Tests runs identically for both admin and user
 * 
 * Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
 */

import { test, expect } from "@playwright/test";

// auth doesnt matter
test.use({ storageState: { cookies: [], origins: [] } });

// user flow
test.describe("Functional E2E", () => {
    test("About link navigates to /about and loads About page", async ({ page }) => {
        await page.goto("/");
        await page.click("div.footer a[href='/about']");
        await expect(page).toHaveURL("/about");
        await expect(page.locator("main")).toBeVisible();
    });

    test("Contact link navigates to /contact and loads Contact page", async ({ page }) => {
        await page.goto("/");
        await page.click("div.footer a[href='/contact']");
        await expect(page).toHaveURL("/contact");
        await expect(page.locator("main")).toBeVisible();
    });

    test("Privacy Policy link navigates to /policy and loads Policy page", async ({ page }) => {
        await page.goto("/");
        await page.click("div.footer a[href='/policy']");
        await expect(page).toHaveURL("/policy");
        await expect(page.locator("main")).toBeVisible();
    });

    test("About page is reachable from About link", async ({ page }) => {
        await page.goto("/");
        await page.locator("div.footer a[href='/about']").click();
        await expect(page).toHaveURL("/about");
    });

    test("Contact page is reachable from Contact link", async ({ page }) => {
        await page.goto("/");
        await page.locator("div.footer a[href='/contact']").click();
        await expect(page).toHaveURL("/contact");
    });

    test("Policy page is reachable from Privacy Policy link", async ({ page }) => {
        await page.goto("/");
        await page.locator("div.footer a[href='/policy']").click();
        await expect(page).toHaveURL("/policy");
    });
});

// ui elements that users see
test.describe("User interface", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
    });

    test("copyright text is visible at the bottom of the page", async ({ page }) => {
        const footer = page.locator("div.footer");
        await expect(footer).toBeVisible();
        await expect(footer).toContainText("All Rights Reserved");
    });

    test("About link is visible", async ({ page }) => {
        await expect(page.locator("div.footer a[href='/about']")).toBeVisible();
    });

    test("Contact link is visible", async ({ page }) => {
        await expect(page.locator("div.footer a[href='/contact']")).toBeVisible();
    });

    test("Privacy Policy link is visible", async ({ page }) => {
        await expect(page.locator("div.footer a[href='/policy']")).toBeVisible();
    });

    test("footer does not overlap the main content area", async ({ page }) => {
        const footerBox = await page.locator("div.footer").boundingBox();
        const mainBox = await page.locator("main").boundingBox();
        if (footerBox && mainBox) {
            expect(footerBox.y).toBeGreaterThanOrEqual(mainBox.y + mainBox.height - 10);
        }
    });
});

// regression testing
test.describe("Regression", () => {
    test("footer renders consistently on the home page", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("div.footer")).toBeVisible();
        await expect(page.locator("div.footer")).toContainText("All Rights Reserved");
    });

    test("footer renders consistently on the About page", async ({ page }) => {
        await page.goto("/about");
        await expect(page.locator("div.footer")).toBeVisible();
        await expect(page.locator("div.footer a[href='/contact']")).toBeVisible();
    });

    test("footer renders consistently on the Contact page", async ({ page }) => {
        await page.goto("/contact");
        await expect(page.locator("div.footer")).toBeVisible();
        await expect(page.locator("div.footer a[href='/about']")).toBeVisible();
    });

    test("footer renders consistently on the Policy page", async ({ page }) => {
        await page.goto("/policy");
        await expect(page.locator("div.footer")).toBeVisible();
        await expect(page.locator("div.footer a[href='/about']")).toBeVisible();
    });

    test("footer links still navigate correctly when not logged in", async ({ page }) => {
        await page.goto("/");
        await page.click("div.footer a[href='/about']");
        await expect(page).toHaveURL("/about");
    });
});