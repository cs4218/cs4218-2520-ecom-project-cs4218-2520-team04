// Teo Kai Xiang A0272558U
// Written by GPT 5.4 Codex based on test plan by me. Reviewed after using code review and manual reading

import { test, expect } from "@playwright/test";
import mongoose from "mongoose";
import dotenv from "dotenv";
import categoryModel from "../../../models/categoryModel.js";
import { getTestMongoUrl } from "../setup/testMongoUrl.js";

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

  if (mongoose.connection.readyState === 3) {
    await new Promise((resolve) => {
      mongoose.connection.once("disconnected", resolve);
    });
  }

  await mongoose.connect(getTestMongoUrl());
};

const cleanupStaleCategoriesPageData = async () => {
  await ensureMongoConnection();
  await categoryModel.deleteMany({
    slug: { $regex: /^playwright-(audio|books)-pw-categories-/ },
  });
};

const seedCategoriesPageData = async () => {
  await ensureMongoConnection();
  await cleanupStaleCategoriesPageData();

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
  await page.goto("/categories", { waitUntil: "domcontentloaded" });
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

  test("category links are visible as primary buttons on the page", async ({
    page,
  }) => {
    // Summary: Verifies every seeded category renders as a visible link on the categories page.
    // Flow: seed categories -> open categories page -> assert each seeded category link is visible.
    for (const category of seededData.categories) {
      await expect(getCategoryLinkByName(page, category.name)).toBeVisible();
    }
  });

  test("each rendered category link points to /category/:slug", async ({
    page,
  }) => {
    // Summary: Verifies each rendered category link targets the slug-based category route.
    // Flow: seed categories -> open categories page -> assert each category link href matches /category/:slug.
    for (const category of seededData.categories) {
      await expect(getCategoryLinkByName(page, category.name)).toHaveAttribute(
        "href",
        `/category/${category.slug}`,
      );
    }
  });

  test("Header is visible on the Categories page", async ({ page }) => {
    // Summary: Verifies the shared header layout renders on the categories page.
    // Flow: seed categories -> open categories page -> assert nav element is visible.
    await expect(page.locator("nav")).toBeVisible();
  });

  test("Footer is visible on the Categories page", async ({ page }) => {
    // Summary: Verifies the shared footer layout renders on the categories page.
    // Flow: seed categories -> open categories page -> assert footer element is visible.
    await expect(page.locator("div.footer")).toBeVisible();
  });

  test("clicking a seeded category link opens the real category page", async ({
    page,
  }) => {
    // Summary: Verifies category navigation uses the real route and renders the target category page.
    // Flow: seed categories -> open categories page -> click one category link -> assert destination URL and category result summary.
    const targetCategory = seededData.categories[0];

    await getCategoryLinkByName(page, targetCategory.name).click();

    await expect(page).toHaveURL(`/category/${targetCategory.slug}`);
    await expect(page.locator(".category")).toContainText(
      `Category - ${targetCategory.name}`,
    );
    await expect(page.locator(".category")).toContainText("0 result found");
  });
});
