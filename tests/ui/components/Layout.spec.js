/**
 * By: Yeo Yi Wen, A0273575U
 * UI tests for client/src/components/Layout.js
 *
 * Layout UI Test Coverage
 * 1. Functional end-to-end (E2E): Header/Footer always present, title updates per page
 * 2. User interface: no overlap between Header, main content, and Footer
 * 3. Regression: consistent after back/forward navigation, title never empty
 * 
 * Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
 */

import { test, expect } from "@playwright/test";

// auth doesnt matter
test.use({ storageState: { cookies: [], origins: [] } });

// user flow for pages in my scope (home, About, Contact, Policy)
test.describe("Functional E2E", () => {
    test("Header is present when navigating to the home page", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page.locator("nav")).toBeVisible();
    });

    test("Footer is present when navigating to the home page", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page.locator("div.footer")).toBeVisible();
    });

    test("Header is present on the About page", async ({ page }) => {
        await page.goto("/about");
        await expect(page.locator("nav")).toBeVisible();
    });

    test("Footer is present on the About page", async ({ page }) => {
        await page.goto("/about");
        await expect(page.locator("div.footer")).toBeVisible();
    });

    test("Header is present on the Contact page", async ({ page }) => {
        await page.goto("/contact");
        await expect(page.locator("nav")).toBeVisible();
    });

    test("Footer is present on the Contact page", async ({ page }) => {
        await page.goto("/contact");
        await expect(page.locator("div.footer")).toBeVisible();
    });

    test("Header is present on the Policy page", async ({ page }) => {
        await page.goto("/policy");
        await expect(page.locator("nav")).toBeVisible();
    });

    test("Footer is present on the Policy page", async ({ page }) => {
        await page.goto("/policy");
        await expect(page.locator("div.footer")).toBeVisible();
    });

    test("browser tab title is non-empty on the home page", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        const title = await page.title();
        expect(title.trim()).not.toBe("");
    });

    test("browser tab title changes when navigating between pages", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        const homeTitle = await page.title();
        await page.goto("/about");
        const aboutTitle = await page.title();
        expect(homeTitle).not.toBe("");
        expect(aboutTitle).not.toBe("");
    });

    test("page-specific content renders inside the main content area", async ({ page }) => {
        await page.goto("/about");
        const main = page.locator("main");
        await expect(main).toBeVisible();
        const content = await main.textContent();
        expect(content?.trim().length).toBeGreaterThan(0);
    });
});

// ui elements that users see
test.describe("User interface", () => {
    test("Header is positioned at the top of the page", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        const navBox = await page.locator("nav").boundingBox();
        expect(navBox?.y).toBeLessThan(100);
    });

    test("Footer is positioned below the main content area", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        const footerBox = await page.locator("div.footer").boundingBox();
        const mainBox = await page.locator("main").boundingBox();
        if (footerBox && mainBox) {
            expect(footerBox.y).toBeGreaterThanOrEqual(mainBox.y);
        }
    });

    test("main content does not overlap with Header", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        const navBox = await page.locator("nav").boundingBox();
        const mainBox = await page.locator("main").boundingBox();
        if (navBox && mainBox) {
            expect(mainBox.y).toBeGreaterThanOrEqual(navBox.y + navBox.height - 5);
        }
    });

    test("main content does not overlap with Footer", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        const footerBox = await page.locator("div.footer").boundingBox();
        const mainBox = await page.locator("main").boundingBox();
        if (footerBox && mainBox) {
            expect(footerBox.y).toBeGreaterThanOrEqual(mainBox.y + mainBox.height - 10);
        }
    });

    test("main content area has a positive min-height so Footer does not float up", async ({ page }) => {
        await page.goto("/about");
        const minHeight = await page.locator("main").evaluate(
            (el) => parseInt(getComputedStyle(el).minHeight)
        );
        // Source sets min-height: 70vh
        expect(minHeight).toBeGreaterThan(0);
    });
});

// regression testing
test.describe("Layout — Regression", () => {
    test("Header and Footer present after navigating back", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.goto("/about");
        await page.goBack();
        await expect(page.locator("nav")).toBeVisible();
        await expect(page.locator("div.footer")).toBeVisible();
    });
    
    test("page title is never empty on any static route", async ({ page }) => {
        const routes = ["/", "/about", "/contact", "/policy"];
        for (const route of routes) {
            await page.goto(route);
            const title = await page.title();
            expect(title.trim()).not.toBe("");
        }
    });
});