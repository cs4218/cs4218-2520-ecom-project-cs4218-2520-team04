/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * UI tests for client/src/pages/ProductDetails.js
 *
 * ProductDetails Test Coverage
 * 1. Functional end-to-end (E2E): full product details display, related product navigation,
 *   page reachable from CategoryProduct via More Details
 * 2. User interface: name, description, price (USD), category, image, ADD TO CART,
 *   Similar Products section, Header and Footer present
 * 3. Regression: back navigation, page refresh, Similar Products updates on navigation
 *
 * auth state doesnt matter as all users have the same view
 *
 * Timing note
 * ───────────
 * goToFirstProduct() resolves as soon as the URL changes to /product/:slug,
 * but the product data is fetched asynchronously after navigation. Any test
 * that reads product content must wait for the API response to populate the
 * DOM before asserting. The beforeEach guard:
 *   await expect(section).toContainText("$", { timeout: 10000 })
 * ensures the price field (which only appears after the API resolves) is
 * present before any assertion runs.
 * 
 * Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
 */

import { test, expect } from "@playwright/test";

// user details doesnt matter
test.use({ storageState: { cookies: [], origins: [] } });

// Navigates to the first available product via CategoryProduct.
const goToFirstProduct = async (page) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });    
    await page.click("a.dropdown-toggle[href='/categories']");
    const categoriesMenu = page.locator(
        "li.nav-item.dropdown:has(a[href='/categories']) ul.dropdown-menu"
    );
    await expect(categoriesMenu).toBeVisible();
    const categoryItems = categoriesMenu.locator("a.dropdown-item");
    if (await categoryItems.count() < 2) return false;

    // Click first real category (skip "All Categories" at index 0)
    await categoryItems.nth(1).click();
    await page.waitForLoadState("networkidle");

    // Click More Details on the first product card
    const moreBtn = page.locator("button:has-text('More Details')").first();
    if (await moreBtn.count() === 0) return false;

    await moreBtn.click();
    await page.waitForURL(/\/product\//);
    return true;
};

// user flow
test.describe("Functional E2E", () => {
    test("navigating to /product/:slug displays the product details section", async ({ page }) => {
        const reached = await goToFirstProduct(page);
        if (!reached) return test.skip();
        await expect(page.locator(".product-details-info")).toBeVisible();
    });

    test("clicking More Details on a related product navigates to that product's page", async ({ page }) => {
        const reached = await goToFirstProduct(page);
        if (!reached) return test.skip();
        const relatedMoreBtn = page.locator(
            ".similar-products button:has-text('More Details')"
        ).first();
        if (await relatedMoreBtn.count() === 0) return test.skip();
        const currentUrl = page.url();
        await relatedMoreBtn.click();
        await page.waitForURL(/\/product\//);
        // Should navigate to a different product's page
        expect(page.url()).not.toBe(currentUrl);
    });

    test("ADD TO CART button is present and clickable without throwing", async ({ page }) => {
        const reached = await goToFirstProduct(page);
        if (!reached) return test.skip();
        const addToCartBtn = page.locator(
            ".product-details-info button:has-text('ADD TO CART')"
        );
        await expect(addToCartBtn).toBeVisible();
        // Button has no onClick handler in current implementation —
        // just verify it is clickable without errors
        await addToCartBtn.click();
    });
});

// ─── User interface ───────────────────────────────────────────────────────────

test.describe("ProductDetails — User interface", () => {
    test.beforeEach(async ({ page }) => {
        const reached = await goToFirstProduct(page);
        if (!reached) test.skip();
        // Wait for product data to load before any test runs.
        // goToFirstProduct resolves on URL change but the API call is async —
        // the price field only appears after the API response populates the DOM.
        // This guard prevents all content assertions from running on empty state.
        await expect(page.locator(".product-details-info")).toContainText("$", {
            timeout: 10000,
        });
    });

    test("product name is visible with 'Name :' label", async ({ page }) => {
        const section = page.locator(".product-details-info");
        const text = await section.textContent();
        expect(text).toMatch(/Name\s*:/);
    });

    test("product description is visible with 'Description :' label", async ({ page }) => {
        const section = page.locator(".product-details-info");
        const text = await section.textContent();
        expect(text).toMatch(/Description\s*:/);
    });

    test("product price is visible formatted as USD currency", async ({ page }) => {
        const section = page.locator(".product-details-info");
        const text = await section.textContent();
        // Price rendered via toLocaleString as $X.XX — beforeEach already
        // confirmed $ is present, this asserts the full Price label + value
        expect(text).toMatch(/Price\s*:.*\$/);
    });

    test("product category is visible with 'Category :' label", async ({ page }) => {
        const section = page.locator(".product-details-info");
        const text = await section.textContent();
        expect(text).toMatch(/Category\s*:/);
    });

    test("product image is visible on the page", async ({ page }) => {
        const productImg = page.locator(".product-details img.card-img-top").first();
        await expect(productImg).toBeVisible();
    });

    test("ADD TO CART button is visible in the product details section", async ({ page }) => {
        await expect(
            page.locator(".product-details-info button:has-text('ADD TO CART')")
        ).toBeVisible();
    });

    test("Similar Products section is visible", async ({ page }) => {
        await expect(page.locator(".similar-products")).toBeVisible();
    });

    test("Similar Products section shows product cards or 'No Similar Products found'", async ({ page }) => {
        const cards = page.locator(".similar-products .card");
        const noProductsMsg = page.locator(
            ".similar-products:has-text('No Similar Products found')"
        );
        const cardCount = await cards.count();
        const hasMsgCount = await noProductsMsg.count();
        // Either product cards exist OR the empty message is shown — never neither
        expect(cardCount > 0 || hasMsgCount > 0).toBe(true);
    });

    test("each related product card displays the name", async ({ page }) => {
        const cards = page.locator(".similar-products .card");
        if (await cards.count() === 0) return;
        await expect(cards.first().locator(".card-title").first()).toBeVisible();
    });

    test("each related product card displays the price", async ({ page }) => {
        const cards = page.locator(".similar-products .card");
        if (await cards.count() === 0) return;
        const cardText = await cards.first().textContent();
        expect(cardText).toMatch(/\$/);
    });

    test("Footer is visible on the ProductDetails page", async ({ page }) => {
        await expect(page.locator("div.footer")).toBeVisible();
    });

    test("page content does not cause horizontal overflow", async ({ page }) => {
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = page.viewportSize()?.width ?? 1280;
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
    });
});

// ─── Regression ───────────────────────────────────────────────────────────────

test.describe("ProductDetails — Regression", () => {
    test("clicking back from ProductDetails returns to CategoryProduct", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });        
        await page.click("a.dropdown-toggle[href='/categories']");
        const categoriesMenu = page.locator(
            "li.nav-item.dropdown:has(a[href='/categories']) ul.dropdown-menu"
        );
        const items = categoriesMenu.locator("a.dropdown-item");
        if (await items.count() < 2) return test.skip();

        const categoryHref = await items.nth(1).getAttribute("href");
        await items.nth(1).click();
        await page.waitForLoadState("networkidle");

        const moreBtn = page.locator("button:has-text('More Details')").first();
        if (await moreBtn.count() === 0) return test.skip();

        await moreBtn.click();
        await page.waitForURL(/\/product\//);
        await page.goBack();
        await expect(page).toHaveURL(categoryHref);
        await expect(page.locator("main")).toBeVisible();
    });

    test("Similar Products section is still visible after navigating to a related product", async ({ page }) => {
        const reached = await goToFirstProduct(page);
        if (!reached) return test.skip();
        const relatedBtn = page.locator(
            ".similar-products button:has-text('More Details')"
        ).first();
        if (await relatedBtn.count() === 0) return test.skip();
        await relatedBtn.click();
        await page.waitForURL(/\/product\//);
        // Similar products section should be present on the newly navigated product
        await expect(page.locator(".similar-products")).toBeVisible();
    });

    test("navigating back from a related product returns to the original product", async ({ page }) => {
        const reached = await goToFirstProduct(page);
        if (!reached) return test.skip();
        const originalUrl = page.url();
        const relatedBtn = page.locator(
            ".similar-products button:has-text('More Details')"
        ).first();
        if (await relatedBtn.count() === 0) return test.skip();
        await relatedBtn.click();
        await page.waitForURL(/\/product\//);
        await page.goBack();
        await expect(page).toHaveURL(originalUrl);
        await expect(page.locator(".product-details-info")).toBeVisible();
    });
});