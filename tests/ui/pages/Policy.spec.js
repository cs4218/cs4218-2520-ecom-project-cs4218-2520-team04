/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * UI tests for client/src/pages/Policy.js (/policy)
 *
 * Privacy Policy Page Test Coverage
 * 1. Functional end-to-end: page loads without error, reachable from Footer
 * 2. User interface: content visible, Header/Footer present, no overflow
 * 3. Regression: loads after back navigation, renders consistently on repeat visits
 *
 * auth state doesnt matter as all users have the same view
 * 
 * Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
 */

import { test, expect } from "@playwright/test";

// user state doesnt matter
test.use({ storageState: { cookies: [], origins: [] } });

// user flows
test.describe("Functional E2E", () => {
    test("navigating to /policy loads the page without error", async ({ page }) => {
        await page.goto("/policy");
        await expect(page.locator("main")).toBeVisible();
    });

    test("Policy page is reachable by clicking the Privacy Policy link in the Footer", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.click("div.footer a[href='/policy']");
        await expect(page).toHaveURL("/policy");
    });
});

// ui elements
test.describe("User interface", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/policy");
    });

    test("browser tab title is non-empty", async ({ page }) => {
        const title = await page.title();
        expect(title.trim()).not.toBe("");
    });

    test("policy content is visible in the main area", async ({ page }) => {
        const main = page.locator("main");
        await expect(main).toBeVisible();
        const content = await main.textContent();
        expect(content?.trim().length).toBeGreaterThan(0);
    });

    test("Header is present on the Policy page", async ({ page }) => {
        await expect(page.locator("nav")).toBeVisible();
    });

    test("Footer is present on the Policy page", async ({ page }) => {
        await expect(page.locator("div.footer")).toBeVisible();
    });

    test("page content does not cause horizontal overflow", async ({ page }) => {
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = page.viewportSize()?.width ?? 1280;
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
    });
});

// regression testing
test.describe("Policy — Regression", () => {
    test("Policy page loads correctly after navigating away and back", async ({ page }) => {
        await page.goto("/policy");
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.goBack();
        await expect(page).toHaveURL("/policy");
        await expect(page.locator("nav")).toBeVisible();
    });

    test("Policy page renders consistently on repeated visits", async ({ page }) => {
        await page.goto("/policy");
        const content1 = await page.locator("main").textContent();
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.goto("/policy");
        const content2 = await page.locator("main").textContent();
        expect(content1).toBe(content2);
    });
});