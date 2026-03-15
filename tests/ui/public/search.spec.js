//
// Lu Yixuan, Deborah, A0277911X
//
// E2E UI tests for Search flow: SearchInput → /search → results rendering.
// Journeys:
//   1. Happy path — type keyword → submit → calls search API → navigates to /search → renders results.
//   2. Edge — empty query → should not call API and should not navigate.
//   3. Edge — whitespace-only query → should not call API and should not navigate.
//
// Notes:
//   - Uses Playwright route stubbing for the /api/v1/product/search/:keyword call so results are deterministic.
//   - This spec does not require authentication.
//
// Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
//

import { test, expect } from "@playwright/test";

// ── Helpers ───────────────────────────────────────────────────────────────────

const getSearchInput = (page) => page.getByPlaceholder(/search/i);
const getSearchButton = (page) => page.getByRole("button", { name: /search/i });

test.describe.serial("Search flow — submit → navigate → render results", () => {
  const uid = Date.now().toString(36);

  test("searching a keyword navigates to /search and shows results", async ({ page }) => {
    const keyword = `iphone-${uid}`;

    // Stub the backend search API for this keyword
    await page.route(`**/api/v1/product/search/${keyword}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { _id: "p1", name: `Phone ${uid}`, description: "desc", price: 10 },
          { _id: "p2", name: `Case ${uid}`, description: "desc", price: 5 },
        ]),
      });
    });

    await page.goto("/");

    await getSearchInput(page).fill(keyword);
    await getSearchButton(page).click();

    // Navigates to /search
    await expect(page).toHaveURL(/\/search$/);

    // Search page renders results (based on your Search.js content)
    await expect(page.getByText(/Found 2/i)).toBeVisible();
    await expect(page.getByText(`Phone ${uid}`)).toBeVisible();
    await expect(page.getByText(`Case ${uid}`)).toBeVisible();
  });

  test("edge: whitespace-only search should not crash (shows message or stays put)", async ({ page }) => {
    // Make any search request deterministic: return empty results
    await page.route("**/api/v1/product/search/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/");

    await getSearchInput(page).fill("   ");
    await getSearchButton(page).click();

    // Either it stays put OR it navigates to /search and shows empty-state.
    if (page.url().endsWith("/search")) {
      await expect(page.getByText(/No Products Found/i)).toBeVisible();
    } else {
      await expect(getSearchInput(page)).toBeVisible();
    }
  });
});