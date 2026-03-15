//
// Tan Wei Lian, A0269750U
//
// E2E UI tests for admin product creation and maintenance flows.
// Journeys:
//   1. Create product — fill form → submit → redirect to products list → product visible.
//   2. Update product — products list → click product card → update fields →
//      list shows new name → update page reflects new values.
//   3. Delete product — products list → click product card → delete via prompt →
//      list no longer shows product.
//   Error cases: missing name on create → error toast; missing name on update → error toast.
//
// Spans: AdminMenu, CreateCategory, CreateProduct, Products list, UpdateProduct,
//        antd Select dropdowns, photo upload, window.prompt, toast system.
// Self-contained: creates and cleans up its own test category.

import { test, expect } from "@playwright/test";

// ── Helpers ───────────────────────────────────────────────────────────────────

const getNameField = (page) => page.getByPlaceholder("write a name");
const getDescriptionField = (page) => page.getByPlaceholder("write a description");
const getPriceField = (page) => page.getByPlaceholder("write a Price");
const getQuantityField = (page) => page.getByPlaceholder("write a quantity");
const getProductCard = (page, name) =>
  page.getByRole("heading", { name, exact: true });
const getToast = (page) => page.locator("div[role='status']");

// Minimal valid JPEG header — avoids needing a real image file on disk
const TINY_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

test.describe.serial("Admin product CRUD — create → update → delete flow", () => {
  const uid = Date.now().toString(36);
  const testCategory = `ProdTestCat ${uid}`;
  const productName = `E2E Product ${uid}`;
  const updatedName = `E2E Product Updated ${uid}`;
  const productDesc = `Description for ${uid}`;
  const updatedDesc = `Updated description for ${uid}`;

  // ── Setup: create a dedicated test category ────────────────────────────────

  test("setup: create test category for products", async ({ page }) => {
    await page.goto("/dashboard/admin/create-category");
    await page.getByPlaceholder("Enter new category").fill(testCategory);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByRole("cell", { name: testCategory })).toBeVisible();
  });

  // ── Error: create with missing name ───────────────────────────────────────

  test("submitting create-product without a name shows an error toast", async ({ page }) => {
    // Journey: navigate to create-product → leave name empty → submit →
    //          handleCreate → API 400 → catch → toast error
    await page.goto("/dashboard/admin/create-product");
    await expect(page.getByRole("heading", { name: "Create Product" })).toBeVisible();

    // Attempt submit with no name (other fields also empty)
    await page.getByRole("button", { name: "CREATE PRODUCT" }).click();

    // Error toast — spans CreateProduct state + handleCreate + API validation path
    await expect(getToast(page)).toBeVisible();
    // Should NOT navigate away
    await expect(page).toHaveURL("/dashboard/admin/create-product");
  });

  // ── Create product ─────────────────────────────────────────────────────────

  test("admin creates a product and is redirected to the products list", async ({ page }) => {
    // Journey: fill all fields including antd Select + file upload →
    //          submit → handleCreate → API POST → navigate to products list →
    //          Products component fetches + renders the new product card
    await page.goto("/dashboard/admin/create-product");
    await expect(page.getByRole("heading", { name: "Create Product" })).toBeVisible();

    // Category: click antd Select, wait for dropdown, pick option by title
    await page.locator(".ant-select").filter({ hasText: "Select a category" }).click();
    await expect(page.getByTitle(testCategory)).toBeVisible();
    await page.getByTitle(testCategory).click();

    // Photo: target the hidden file input inside the label
    await page.locator('input[type="file"][name="photo"]').setInputFiles({
      name: "test.jpg",
      mimeType: "image/jpeg",
      buffer: TINY_JPEG,
    });

    await getNameField(page).fill(productName);
    await getDescriptionField(page).fill(productDesc);
    await getPriceField(page).fill("99");
    await getQuantityField(page).fill("5");

    // Shipping select
    await page.locator(".ant-select").filter({ hasText: "Select Shipping" }).click();
    await page
      .locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden)")
      .getByTitle("No")
      .click();

    await page.getByRole("button", { name: "CREATE PRODUCT" }).click();

    // Redirected to products list — new product card is visible
    await expect(page).toHaveURL("/dashboard/admin/products");
    await expect(getProductCard(page, productName)).toBeVisible();
    await expect(page.getByText(productDesc)).toBeVisible();
  });

  // ── Update product ─────────────────────────────────────────────────────────

  test("admin updates a product from the products list and the list reflects the new name", async ({
    page,
  }) => {
    // Journey: products list → click card → UpdateProduct page loads with pre-populated
    //          fields (getSingleProduct useEffect) → edit → submit → navigate back to list →
    //          updated name visible
    await page.goto("/dashboard/admin/products");
    await expect(page.getByRole("heading", { name: "All Products List" })).toBeVisible();

    // Click the product card heading to open the update page
    await getProductCard(page, productName).click();
    await expect(page.getByRole("heading", { name: "Update Product" })).toBeVisible();

    // Fields pre-populated by getSingleProduct useEffect
    await expect(getNameField(page)).toHaveValue(productName);
    await expect(getDescriptionField(page)).toHaveValue(productDesc);

    // Edit name and description
    await getNameField(page).fill(updatedName);
    await getDescriptionField(page).fill(updatedDesc);

    await page.getByRole("button", { name: "UPDATE PRODUCT" }).click();

    // Redirected to products list — updated name is visible; old name is gone
    await expect(page).toHaveURL("/dashboard/admin/products");
    await expect(getProductCard(page, updatedName)).toBeVisible();
    await expect(page.getByText(updatedDesc)).toBeVisible();
    await expect(page.getByRole("heading", { name: productName, exact: true })).not.toBeVisible();
  });

  test("update page shows the latest product data after navigation back", async ({ page }) => {
    // Journey: products list → click updated product → verify update page
    //          shows the new name (getSingleProduct fetches fresh from API)
    await page.goto("/dashboard/admin/products");
    await getProductCard(page, updatedName).click();

    await expect(page.getByRole("heading", { name: "Update Product" })).toBeVisible();
    await expect(getNameField(page)).toHaveValue(updatedName);
    await expect(getDescriptionField(page)).toHaveValue(updatedDesc);
  });

  // ── Delete product ─────────────────────────────────────────────────────────

  test("admin deletes a product and it vanishes from the products list", async ({ page }) => {
    // Journey: products list → click card → update page → DELETE PRODUCT button →
    //          window.prompt accepted → handleDelete → API DELETE → navigate to products list
    await page.goto("/dashboard/admin/products");
    await getProductCard(page, updatedName).click();
    await expect(getNameField(page)).toHaveValue(updatedName);

    // Accept the window.prompt confirmation dialog
    page.once("dialog", (dialog) => dialog.accept("yes"));
    await page.getByRole("button", { name: "DELETE PRODUCT" }).click();

    // Redirected back to products list — product is gone
    await expect(page).toHaveURL("/dashboard/admin/products");
    await expect(page.getByRole("heading", { name: updatedName })).not.toBeVisible();
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────

  test("cleanup: delete the test category", async ({ page }) => {
    await page.goto("/dashboard/admin/create-category");
    const row = page.getByRole("row").filter({ hasText: testCategory });
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("cell", { name: testCategory })).not.toBeVisible();
  });
});
