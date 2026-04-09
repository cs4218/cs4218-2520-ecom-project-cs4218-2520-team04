//
// Lu Yixuan, Deborah, A0277911X
//
// E2E UI tests for Profile update flow.
// Happy path:
//   authenticated user → /dashboard/user/profile → update fields → submit → success toast → reload → values persist.
// Negative:
//   invalid input (short password) → request rejected (data.error) → error toast → values not overwritten.
//
// Uses Playwright route stubbing for /api/v1/auth/profile to keep tests deterministic.
//
// Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
//

import { test, expect } from "@playwright/test";
import path from "path";

const authFile = path.join("playwright", ".auth.json");
const PROFILE_ROUTE = "/dashboard/user/profile";

const nameInput = (page) => page.getByPlaceholder("Enter Your Name");
const emailInput = (page) => page.getByPlaceholder("Enter Your Email ");
const passwordInput = (page) => page.getByPlaceholder("Enter Your Password");
const phoneInput = (page) => page.getByPlaceholder("Enter Your Phone");
const addressInput = (page) => page.getByPlaceholder("Enter Your Address");
const updateButton = (page) => page.getByRole("button", { name: "UPDATE" });

test.describe.serial("UI: Update Profile → Persist → Refresh page", () => {
  test.use({ storageState: authFile });

  test("updates profile, shows success toast, and persists after reload", async ({ page }) => {
    const uid = Date.now().toString(36);

    const updatedUser = {
      name: `New Name ${uid}`,
      email: "test@admin.com", // email stays same in UI (disabled)
      phone: `98${uid.slice(0, 6)}`.slice(0, 8), // keep it short-ish
      address: `New Addr ${uid}`,
    };

    // Stub update profile API (frontend expects { updatedUser })
    await page.route("**/api/v1/auth/profile", async (route) => {
      if (route.request().method().toUpperCase() !== "PUT") {
        return route.continue();
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ updatedUser }),
      });
    });

    await page.goto(PROFILE_ROUTE);

    await expect(emailInput(page)).toBeDisabled();

    // Update fields
    await nameInput(page).fill(updatedUser.name);
    await passwordInput(page).fill("NewPass123!"); // valid policy
    await phoneInput(page).fill(updatedUser.phone);
    await addressInput(page).fill(updatedUser.address);

    await updateButton(page).click();

    // Success feedback
    await expect(page.getByText("Profile Updated Successfully")).toBeVisible();

    // Reload and verify persistence (values remain)
    await page.reload();

    await expect(nameInput(page)).toHaveValue(updatedUser.name);
    await expect(phoneInput(page)).toHaveValue(updatedUser.phone);
    await expect(addressInput(page)).toHaveValue(updatedUser.address);

    await expect(emailInput(page)).toHaveValue("test@admin.com");
  });

  test("negative: invalid password shows error toast and does not overwrite fields", async ({ page }) => {
    const uid = Date.now().toString(36);

    await page.goto(PROFILE_ROUTE);

    await expect(nameInput(page)).not.toHaveValue("");

    const beforeName = await nameInput(page).inputValue();
    const beforePhone = await phoneInput(page).inputValue();
    const beforeAddress = await addressInput(page).inputValue();

    // Stub API to respond with { error } (frontend checks data.error)
    await page.route("**/api/v1/auth/profile", async (route) => {
        if (route.request().method().toUpperCase() !== "PUT") return route.continue();
        await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: "Password must be at least 10 characters long and include uppercase, lowercase, number, and special characters." }),
        });
    });

    // Make some edits + invalid password
    await nameInput(page).fill(`Bad Update ${uid}`);
    await passwordInput(page).fill("123"); // invalid
    await phoneInput(page).fill("91111111");
    await addressInput(page).fill("Bad Addr");

    await updateButton(page).click();

    // Error feedback
    await expect(page.getByText("Password must be at least 10 characters long and include uppercase, lowercase, number, and special characters.")).toBeVisible();

    // Reload and ensure original values still there (update rejected)
    await page.reload();

    await expect(nameInput(page)).toHaveValue(beforeName);
    await expect(phoneInput(page)).toHaveValue(beforePhone);
    await expect(addressInput(page)).toHaveValue(beforeAddress);
    });
});
