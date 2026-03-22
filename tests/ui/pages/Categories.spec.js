/**
 * By: OpenAI Codex
 *
 * UI tests for client/src/pages/Categories.js (/categories)
 *
 * Coverage
 * 1. User interface: category links render as button-styled links
 * 2. User interface: each rendered category link points to /category/:slug
 * 3. User interface: Header and Footer are visible on the page
 */

import { test, expect } from "@playwright/test";
import mongoose from "mongoose";
import dotenv from "dotenv";
import categoryModel from "../../../models/categoryModel.js";

dotenv.config();

test.use({ storageState: { cookies: [], origins: [] } });
test.afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

const ensureMongoConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return;
  }

  await mongoose.connect(process.env.MONGO_URL);
};

const seedCategoriesPageData = async () => {
  await ensureMongoConnection();

  const uniqueTag = `pw-categories-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const categories = await categoryModel.create([
    {
      name: `Playwright Audio ${uniqueTag}`,
      slug: `playwright-audio-${uniqueTag}`,
    },
    {
      name: `Playwright Books ${uniqueTag}`,
      slug: `playwright-books-${uniqueTag}`,
    },
  ]);

  return { categories };
};

const cleanupSeededCategoriesPageData = async (categoryIds) => {
  await ensureMongoConnection();
  await categoryModel.deleteMany({ _id: { $in: categoryIds } });
};

const getCategoryLinkByName = (page, categoryName) =>
  page.getByRole("link", { name: categoryName });

const goToCategoriesPage = async (page, firstCategoryName) => {
  await page.goto("/categories");
  await expect(page.locator("nav")).toBeVisible();
  await expect(getCategoryLinkByName(page, firstCategoryName)).toBeVisible({
    timeout: 10000,
  });
};

test.describe("User interface", () => {
  let seededData;

  test.beforeEach(async ({ page }) => {
    seededData = await seedCategoriesPageData();
    await goToCategoriesPage(page, seededData.categories[0].name);
  });

  test.afterEach(async () => {
    if (!seededData) return;

    await cleanupSeededCategoriesPageData(
      seededData.categories.map((category) => category._id),
    );
    seededData = null;
  });

  test("category links are visible as primary buttons on the page", async ({ page }) => {
    for (const category of seededData.categories) {
      await expect(getCategoryLinkByName(page, category.name)).toBeVisible();
    }
  });

  test("each rendered category link points to /category/:slug", async ({ page }) => {
    for (const category of seededData.categories) {
      await expect(getCategoryLinkByName(page, category.name)).toHaveAttribute(
        "href",
        `/category/${category.slug}`,
      );
    }
  });

  test("Header is visible on the Categories page", async ({ page }) => {
    await expect(page.locator("nav")).toBeVisible();
  });

  test("Footer is visible on the Categories page", async ({ page }) => {
    await expect(page.locator("div.footer")).toBeVisible();
  });

  test("clicking a seeded category link opens the real category page", async ({
    page,
  }) => {
    const targetCategory = seededData.categories[0];

    await getCategoryLinkByName(page, targetCategory.name).click();

    await expect(page).toHaveURL(`/category/${targetCategory.slug}`);
    await expect(page.locator(".category")).toContainText(
      `Category - ${targetCategory.name}`,
    );
    await expect(page.locator(".category")).toContainText("0 result found");
  });
});
