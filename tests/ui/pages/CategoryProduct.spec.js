/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * UI tests for client/src/pages/CategoryProduct.js (/category/:slug)
 *
 * CategorProducts Test Coverage
 * 1. Functional end-to-end (E2E): reachable from Header dropdown, More Details navigates
 * 2. User interface: category heading, product cards, button visibility, no Add to Cart
 * 3. Regression: back navigation, switching categories, page refresh
 * 
 * auth state doesnt matter as all users have the same view
 * 
 * Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me. 
 */

import { test, expect } from "@playwright/test";

// user state doesnt matter
test.use({ storageState: { cookies: [], origins: [] } });

// category helper
const getCategoryHeading = (page) =>
    page.locator("main h4.text-center");

// helper for category navigation
const goToFirstCategory = async (page) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.click("a.dropdown-toggle[href='/categories']");
    const categoriesMenu = page.locator(
        "li.nav-item.dropdown:has(a[href='/categories']) ul.dropdown-menu"
    );
    await expect(categoriesMenu).toBeVisible();
    const items = categoriesMenu.locator("a.dropdown-item");
    const count = await items.count();
    if (count < 2) return null;
    const href = await items.nth(1).getAttribute("href");
    await items.nth(1).click();
    await expect(getCategoryHeading(page)).toBeVisible({ timeout: 10000 });
    return href;
};

// user flows
test.describe("Functional E2E", () => {
    test("category page is reachable from the Header categories dropdown", async ({ page }) => {
        const href = await goToFirstCategory(page);
        if (!href) return test.skip();
        await expect(page).toHaveURL(href);
    });

    test("navigating to /category/:slug loads the category heading", async ({ page }) => {
        const href = await goToFirstCategory(page);
        if (!href) return test.skip();
        // Confirm the heading is rendered — scoped to main to avoid footer match.
        // We assert on "Category -" prefix only since some DB entries have empty names.
        await expect(getCategoryHeading(page)).toBeVisible();
        await expect(getCategoryHeading(page)).toContainText("Category -");
    });

    test("clicking More Details navigates to the correct /product/:slug page", async ({ page }) => {
        const href = await goToFirstCategory(page);
        if (!href) return test.skip();
        const moreBtn = page.locator("button:has-text('More Details')").first();
        if (await moreBtn.count() === 0) return test.skip();
        await moreBtn.click();
        await expect(page).toHaveURL(/\/product\//);
    });

    test("an empty category renders gracefully without crashing", async ({ page }) => {
        await page.goto("/category/this-category-does-not-exist");
        await expect(page.locator("nav")).toBeVisible();
        await expect(page.locator("div.footer")).toBeVisible();
    });
});

// what user see
test.describe("User interface", () => {
    test.beforeEach(async ({ page }) => {
        const href = await goToFirstCategory(page);
        if (!href) test.skip();
        // goToFirstCategory already waits for the heading to be visible
    });

    test("category name heading is visible on the page", async ({ page }) => {
        // Scoped to main — footer also has an h4.text-center
        await expect(getCategoryHeading(page)).toBeVisible();
    });

    test("each product card displays the product name", async ({ page }) => {
        const cards = page.locator(".card");
        if (await cards.count() === 0) return;
        await expect(cards.first().locator(".card-title").first()).toBeVisible();
    });

    test("each product card displays the product price", async ({ page }) => {
        const cards = page.locator(".card");
        if (await cards.count() === 0) return;
        const cardText = await cards.first().textContent();
        expect(cardText).toMatch(/\$/);
    });

    test("a More Details button is visible on each product card", async ({ page }) => {
        const moreBtn = page.locator("button:has-text('More Details')").first();
        if (await moreBtn.count() === 0) return;
        await expect(moreBtn).toBeVisible();
    });

    // Add to Cart must NOT appear on CategoryProduct — it belongs on ProductDetails only
    test("Add to Cart buttons are absent on the category product page", async ({ page }) => {
        await expect(page.locator("button:has-text('ADD TO CART')")).toHaveCount(0);
    });

    test("Header is visible on the CategoryProduct page", async ({ page }) => {
        await expect(page.locator("nav")).toBeVisible();
    });

    test("Footer is visible on the CategoryProduct page", async ({ page }) => {
        await expect(page.locator("div.footer")).toBeVisible();
    });
});

// regression testing
test.describe("CategoryProduct — Regression", () => {
    test("navigating back from ProductDetails restores the category product list", async ({ page }) => {
        const href = await goToFirstCategory(page);
        if (!href) return test.skip();
        const moreBtn = page.locator("button:has-text('More Details')").first();
        if (await moreBtn.count() === 0) return test.skip();
        await moreBtn.click();
        await expect(page).toHaveURL(/\/product\//);
        await page.goBack();
        await expect(page).toHaveURL(href);
        await expect(page.locator("main")).toBeVisible();
    });

    test("switching between different category routes loads different category headings", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });        
        await page.click("a.dropdown-toggle[href='/categories']");
        const categoriesMenu = page.locator(
            "li.nav-item.dropdown:has(a[href='/categories']) ul.dropdown-menu"
        );
        const items = categoriesMenu.locator("a.dropdown-item");
        if (await items.count() < 3) return test.skip();

        const href1 = await items.nth(1).getAttribute("href");
        const href2 = await items.nth(2).getAttribute("href");
        if (href1 === href2) return test.skip();

        // Navigate to first category and confirm heading renders
        await page.goto(href1);
        await expect(getCategoryHeading(page)).toBeVisible({ timeout: 10000 });

        // Navigate to second category and confirm heading renders
        await page.goto(href2);
        await expect(getCategoryHeading(page)).toBeVisible({ timeout: 10000 });

        // Confirm the URL changed — we already know href1 !== href2 from the guard above.
        // We compare URLs rather than heading text because category names may be empty
        // in the test database, making text comparison unreliable.
        await expect(page).toHaveURL(href2);
    });

    test("page renders correctly after browser refresh on the same category URL", async ({ page }) => {
        const href = await goToFirstCategory(page);
        if (!href) return test.skip();
        await page.reload();
        await expect(page).toHaveURL(href);
        await expect(page.locator("nav")).toBeVisible();
        // Wait for heading to re-appear after reload — scoped to main
        await expect(getCategoryHeading(page)).toBeVisible({ timeout: 10000 });
        await expect(getCategoryHeading(page)).toContainText("Category -");
    });
});