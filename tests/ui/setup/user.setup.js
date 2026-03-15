//
// Lu Yixuan, Deborah, A0277911X
//
// Logs in as a normal user and saves storage state to playwright/.user.auth.json
//

import { test as setup, expect } from "@playwright/test";
import path from "path";

const userAuthFile = path.join("playwright", ".user.auth.json");

setup("authenticate as normal user", async ({ page }) => {
  await page.goto("/login");

  await page.getByPlaceholder("Enter Your Email ").fill("user@test.com");
  await page.getByPlaceholder("Enter Your Password").fill("user@test.com");
  await page.getByRole("button", { name: "LOGIN" }).click();

  await page.waitForURL("/");
  await expect(page).toHaveURL("/");

  await page.context().storageState({ path: userAuthFile });
});