//
// Tan Wei Lian, A0269750U
//
// E2E UI tests for admin category management flow.
// Journey: login (via storageState) → error on empty submit → create category →
//          error on duplicate submit → edit via modal → navigate away and back
//          (persistence check) → delete → verify removed.
//
// Spans: Header (auth), AdminMenu, CreateCategory page, CategoryForm component,
//        antd Modal, toast notification system, API layer.
// Self-contained: unique category names prevent conflicts between test runs.

import { test, expect } from "@playwright/test";

// ── Helpers ───────────────────────────────────────────────────────────────────

const getCategoryInput = (page) => page.getByPlaceholder("Enter new category");
const getSubmitBtn = (page) => page.getByRole("button", { name: "Submit" });
const getCategoryRow = (page, name) =>
  page.getByRole("row").filter({ hasText: name });
const getToast = (page) => page.locator("div[role='status']");

test.describe.serial("Admin category management — full CRUD flow with error cases", () => {
  // Unique suffix prevents conflicts between parallel CI runs
  const uid = Date.now().toString(36);
  const categoryName = `E2E Category ${uid}`;
  const updatedName = `E2E Category Updated ${uid}`;

  // ── Error: empty submit ───────────────────────────────────────────────────

  test("submitting empty category name shows an error toast", async ({ page }) => {
    // Journey: navigate to create-category → submit empty form →
    //          CategoryForm onSubmit → handleSubmit → API 400 → catch → toast
    await page.goto("/dashboard/admin/create-category");
    await expect(page.getByRole("heading", { name: "Manage Category" })).toBeVisible();

    await getSubmitBtn(page).click();

    // Error toast appears — spans CategoryForm + handleSubmit + API error path
    await expect(getToast(page)).toBeVisible();
  });

  // ── Create ─────────────────────────────────────────────────────────────────

  test("admin creates a new category and it appears in the table", async ({ page }) => {
    await page.goto("/dashboard/admin/create-category");

    await getCategoryInput(page).fill(categoryName);
    await getSubmitBtn(page).click();

    // Category row appears in the table after API success
    await expect(page.getByRole("cell", { name: categoryName })).toBeVisible();
  });

  // ── Error: duplicate submit ───────────────────────────────────────────────

  test("submitting a duplicate category name shows an error toast", async ({ page }) => {
    // Journey: submit same name again → API 409 → catch → toast error
    await page.goto("/dashboard/admin/create-category");
    await expect(page.getByRole("cell", { name: categoryName })).toBeVisible();

    await getCategoryInput(page).fill(categoryName);
    await getSubmitBtn(page).click();

    // Error toast indicates duplicate — spans CategoryForm + handleSubmit + API error
    await expect(getToast(page)).toBeVisible();

    // Category count must not increase (no duplicate created)
    const cells = page.getByRole("cell", { name: categoryName, exact: true });
    await expect(cells).toHaveCount(1);
  });

  // ── Edit ───────────────────────────────────────────────────────────────────

  test("admin edits the category via the modal and sees the updated name", async ({ page }) => {
    // Journey: click Edit → antd Modal opens → CategoryForm pre-populated →
    //          type new name → Submit → handleUpdate → API PUT → table updated
    await page.goto("/dashboard/admin/create-category");
    await expect(page.getByRole("cell", { name: categoryName })).toBeVisible();

    // Click Edit in the specific row (row-filter is more stable than nth())
    await getCategoryRow(page, categoryName).getByRole("button", { name: "Edit" }).click();

    // antd Modal opens — CategoryForm inside is pre-populated with current name
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder("Enter new category")).toHaveValue(categoryName);

    await dialog.getByPlaceholder("Enter new category").fill(updatedName);
    await dialog.getByRole("button", { name: "Submit" }).click();

    // Updated name visible in table; old name gone
    await expect(page.getByRole("cell", { name: updatedName })).toBeVisible();
    await expect(page.getByRole("cell", { name: categoryName, exact: true })).not.toBeVisible();
  });

  // ── Persist across navigation ─────────────────────────────────────────────

  test("updated category persists after navigating to admin dashboard and back", async ({
    page,
  }) => {
    // Journey: navigate away via AdminMenu → React Router route change →
    //          navigate back → getAllCategory refetch → table re-renders with DB data
    await page.goto("/dashboard/admin");
    await expect(page).toHaveURL("/dashboard/admin");

    await page.goto("/dashboard/admin/create-category");
    await expect(page.getByRole("cell", { name: updatedName })).toBeVisible();
  });

  // ── Delete ─────────────────────────────────────────────────────────────────

  test("admin deletes the category and it is removed from the table", async ({ page }) => {
    // Journey: click Delete → handleDelete → API DELETE → getAllCategory refetch →
    //          table re-renders without the deleted row
    await page.goto("/dashboard/admin/create-category");
    await expect(page.getByRole("cell", { name: updatedName })).toBeVisible();

    await getCategoryRow(page, updatedName).getByRole("button", { name: "Delete" }).click();

    // Row disappears immediately after delete API succeeds
    await expect(page.getByRole("cell", { name: updatedName })).not.toBeVisible();

    // Reload page to confirm deletion is persisted server-side
    await page.reload();
    await expect(page.getByRole("cell", { name: updatedName })).not.toBeVisible();
  });
});
