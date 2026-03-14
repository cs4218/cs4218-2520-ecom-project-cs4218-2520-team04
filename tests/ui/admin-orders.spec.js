//
// Tan Wei Lian, A0269750U
//
// E2E UI tests for admin orders flow.
// Journey: login (storageState) → navigate to admin orders → view order list →
//          change order status → navigate away → navigate back → verify status persisted.
// Spans: Header, AdminMenu, AdminOrders page, antd Select status dropdown.
// Note: status-change test is skipped automatically when the DB has no orders.

import { test, expect } from "@playwright/test";

test.describe("Admin orders — order status management", () => {
  // ── Page renders ───────────────────────────────────────────────────────────

  test("admin can reach the orders page via the admin menu", async ({ page }) => {
    await page.goto("/dashboard/admin");

    // Navigate via the AdminMenu link — spans Header + AdminMenu + AdminOrders
    await page.getByRole("link", { name: /orders/i }).click();

    await expect(page).toHaveURL("/dashboard/admin/orders");
    await expect(page.getByRole("heading", { name: "All Orders" })).toBeVisible();
  });

  test("admin orders page displays order table columns", async ({ page }) => {
    await page.goto("/dashboard/admin/orders");
    await expect(page.getByRole("heading", { name: "All Orders" })).toBeVisible();

    // global-setup.js seeds at least one order, so column headers are always rendered
    await expect(page.locator(".border.shadow").first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "#" }).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" }).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Buyer" }).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Payment" }).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Quantity" }).first()).toBeVisible();
  });

  // ── Status change + persistence ────────────────────────────────────────────

  test("admin changes an order status and it persists after navigating away and back", async ({
    page,
  }) => {
    // global-setup.js seeds at least one order so this test always runs
    await page.goto("/dashboard/admin/orders");
    await expect(page.getByRole("heading", { name: "All Orders" })).toBeVisible();

    // Wait for at least one order row to be rendered
    await expect(page.locator(".border.shadow").first()).toBeVisible();

    // Get the current status from the first order's Select
    const firstSelect = page.locator(".ant-select").first();
    const currentStatusEl = firstSelect.locator(".ant-select-selection-item");
    const currentStatus = await currentStatusEl.textContent();

    // Pick a different status to switch to
    const statusOptions = ["Not Process", "Processing", "Shipped", "delivered", "cancel"];
    const newStatus = statusOptions.find((s) => s !== currentStatus?.trim()) || "Processing";

    // Open dropdown and select new status
    await firstSelect.click();
    await page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden)")
      .getByTitle(newStatus)
      .click();

    // Navigate away to admin dashboard
    await page.goto("/dashboard/admin");
    await expect(page).toHaveURL("/dashboard/admin");

    // Navigate back — orders are re-fetched from the API
    await page.goto("/dashboard/admin/orders");
    await expect(page.getByRole("heading", { name: "All Orders" })).toBeVisible();

    // The updated status should be reflected
    await expect(
      page.locator(".ant-select").first().locator(".ant-select-selection-item")
    ).toHaveText(newStatus);
  });
});
