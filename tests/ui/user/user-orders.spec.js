//
// Lu Yixuan, Deborah, A0277911X
//
// E2E UI tests for user orders viewing flow.
// Journey (happy path):
//   login (via storageState from auth.setup) → navigate to /dashboard/user/orders →
//   Orders page fetches /api/v1/auth/orders → renders order tables + product cards.
// Negative:
//   unauthenticated session → navigate to /dashboard/user/orders →
//   no orders data rendered (since auth.token is missing; page should not crash).
//
// Uses stable fixtures via Playwright route stubbing for /api/v1/auth/orders.
//
// Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
//

import { test, expect } from "@playwright/test";
import path from "path";

// Same auth state path used by auth.setup.js
const authFile = path.join("playwright", ".auth.json");

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORDERS_ROUTE = "/dashboard/user/orders";
const getOrdersHeading = (page) => page.getByRole("heading", { name: "All Orders" });
const getOrderTables = (page) => page.locator("table.table");

// Minimal valid JPEG header — avoids needing a real image file on disk
const TINY_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

test.describe.serial("UI: Login → View Orders → Validate order list rendering", () => {
  test.use({ storageState: authFile });

  test("authenticated user sees orders list with correct count + key fields", async ({ page }) => {
    const uid = Date.now().toString(36);

    // ── Stable fixture: stub the Orders API ─────────────────────────────────
    await page.route("**/api/v1/auth/orders", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            _id: `o1-${uid}`,
            status: "Processing",
            buyer: { name: "Test Admin" },
            createdAt: "2026-03-15T00:00:00.000Z",
            payment: { success: true },
            products: [
              {
                _id: `p1-${uid}`,
                name: `Item A ${uid}`,
                description: "This is a long description for item A",
                price: 12.34,
              },
            ],
          },
          {
            _id: `o2-${uid}`,
            status: "Shipped",
            buyer: { name: "Test Admin" },
            createdAt: "2026-03-14T00:00:00.000Z",
            payment: { success: false },
            products: [],
          },
        ]),
      });
    });

    // Stub product photo requests so image loads don’t flake the test
    await page.route("**/api/v1/product/product-photo/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: TINY_JPEG,
      });
    });

    // ── Journey: navigate → page renders tables + product cards ──────────────
    await page.goto(ORDERS_ROUTE);

    await expect(getOrdersHeading(page)).toBeVisible();

    // There should be 2 orders => 2 tables
    await expect(getOrderTables(page)).toHaveCount(2);

    // Validate key fields for Order #1 (assert by column index to avoid strict-mode ambiguity)
    const firstTable = getOrderTables(page).nth(0);
    const firstRowCells = firstTable.locator("tbody tr td");

    await expect(firstRowCells.nth(0)).toHaveText("1"); // #
    await expect(firstRowCells.nth(1)).toHaveText("Processing"); // Status
    await expect(firstRowCells.nth(2)).toHaveText("Test Admin"); // Buyer
    await expect(firstRowCells.nth(3)).not.toHaveText(""); // Date (moment.fromNow)
    await expect(firstRowCells.nth(4)).toHaveText("Success"); // Payment
    await expect(firstRowCells.nth(5)).toHaveText("1"); // Quantity

    // Product card for first order
    await expect(page.getByText(`Item A ${uid}`)).toBeVisible();
    await expect(page.getByText(/Price\s*:\s*12\.34/)).toBeVisible();

    // Validate key fields for Order #2
    const secondTable = getOrderTables(page).nth(1);
    const secondRowCells = secondTable.locator("tbody tr td");

    await expect(secondRowCells.nth(0)).toHaveText("2"); // #
    await expect(secondRowCells.nth(1)).toHaveText("Shipped"); // Status
    await expect(secondRowCells.nth(2)).toHaveText("Test Admin"); // Buyer
    await expect(secondRowCells.nth(3)).not.toHaveText(""); // Date
    await expect(secondRowCells.nth(4)).toHaveText("Failed"); // Payment
    await expect(secondRowCells.nth(5)).toHaveText("0"); // Quantity
  });

  test("negative: unauthenticated user does not see orders rendered (no crash)", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.route("**/api/v1/auth/orders", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Invalid or expired token" }),
      });
    });

    await page.goto(ORDERS_ROUTE);

    // Page should not crash; heading still renders
    await expect(getOrdersHeading(page)).toBeVisible();

    // Orders list should be empty (no tables rendered)
    await expect(getOrderTables(page)).toHaveCount(0);

    await context.close();
  });
});