/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * UI tests for client/src/pages/Contact.js (/contact)
 *
 * Contact Page Coverage Test
 * 1. Functional end-to-end (E2E): page loads without error, reachable from Footer
 * 2. User interface: content visible, Header/Footer present, no overflow
 * 3. Regression: loads after back navigation, renders consistently on repeat visits
 *
 * auth state doesnt matter as all users have the same view
 * 
 * Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
 */

import { test, expect } from "@playwright/test";

// auth doesnt matter
test.use({ storageState: { cookies: [], origins: [] } });

// user flows
test.describe("Functional E2E", () => {
    test("navigating to /contact loads the page without error", async ({ page }) => {
        await page.goto("/contact");
        await expect(page.locator("main")).toBeVisible();
    });

    test("Contact page is reachable by clicking the Contact link in the Footer", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.click("div.footer a[href='/contact']");
        await expect(page).toHaveURL("/contact");
    });
});

// user elements
test.describe("User interface", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/contact");
    });

    test("browser tab title is non-empty", async ({ page }) => {
        const title = await page.title();
        expect(title.trim()).not.toBe("");
    });

    test("contact information is visible in the main area", async ({ page }) => {
        const main = page.locator("main");
        await expect(main).toBeVisible();
        const content = await main.textContent();
        expect(content?.trim().length).toBeGreaterThan(0);
    });

    test("Header is present on the Contact page", async ({ page }) => {
        await expect(page.locator("nav")).toBeVisible();
    });

    test("Footer is present on the Contact page", async ({ page }) => {
        await expect(page.locator("div.footer")).toBeVisible();
    });

    test("page content does not cause horizontal overflow", async ({ page }) => {
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = page.viewportSize()?.width ?? 1280;
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
    });
});

// regression
test.describe("Regression", () => {
    test("Contact page loads correctly after navigating away and back", async ({ page }) => {
        await page.goto("/contact");
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.goBack();
        await expect(page).toHaveURL("/contact");
        await expect(page.locator("nav")).toBeVisible();
    });

    test("Contact page renders consistently on repeated visits", async ({ page }) => {
        await page.goto("/contact");
        const content1 = await page.locator("main").textContent();
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.goto("/contact");
        const content2 = await page.locator("main").textContent();
        expect(content1).toBe(content2);
    });
});