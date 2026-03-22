/**
 * By: OpenAI Codex
 *
 * UI tests for client/src/pages/CartPage.js (/cart)
 *
 * Coverage
 * 1. Functional E2E: add a product from HomePage and remove it from CartPage
 * 2. User interface: cart summary, guest checkout CTA, item card content, and empty-cart state
 */

import { test, expect } from "@playwright/test";
import mongoose from "mongoose";
import dotenv from "dotenv";
import categoryModel from "../../../models/categoryModel.js";
import productModel from "../../../models/productModel.js";
import orderModel from "../../../models/orderModel.js";
import userModel from "../../../models/userModel.js";

dotenv.config();

test.use({ storageState: { cookies: [], origins: [] } });
test.afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

const getHomeProductCards = (page) =>
  page.locator(".home-page .col-md-9 .card:has(button:has-text('ADD TO CART'))");

const getCartBadge = (page) =>
  page.locator("sup.ant-badge-count");

const getCartSummary = (page) =>
  page.locator(".cart-summary");

const getCartItems = (page) =>
  page.locator(".cart-page .row.card.flex-row");

const getFirstCartItem = (page) =>
  getCartItems(page).first();

const getOrdersTables = (page) =>
  page.locator("table.table");

const getStoredCartSnapshot = (page) =>
  page.evaluate(() => {
    const rawCart = window.localStorage.getItem("cart");
    const parsedCart = rawCart ? JSON.parse(rawCart) : [];

    return parsedCart.map(({ _id, name, price }) => ({
      _id,
      name,
      price,
    }));
  });

const buildCartSnapshot = (cartItems) =>
  cartItems.map(({ _id, name, price }) => ({
    _id,
    name,
    price,
  }));

const guestCartProduct = {
  _id: "pw-cart-item",
  name: "Playwright Cart Speaker",
  description: "Portable speaker created for cart page UI verification.",
  price: 24,
};

const userWithoutAddressAuth = {
  user: {
    name: "Playwright User",
    email: "no-address@test.com",
    address: "",
    role: 0,
  },
  token: "playwright-no-address-token",
};

const loadHomePage = async (page) => {
  await page.goto("/");
  await expect(page.locator("h1.text-center")).toContainText("All Products");
  await expect(getHomeProductCards(page).first()).toBeVisible({ timeout: 10000 });
};

const parseCurrency = (priceText) =>
  Number(priceText.replace(/[^0-9.]/g, ""));

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

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

const buildCheckoutSeededProduct = ({
  name,
  price,
  categoryId,
  slugPrefix,
  order,
}) => ({
  name,
  slug: `${slugPrefix}-${order}`,
  description: `${name} description for checkout happy path coverage.`,
  price,
  category: categoryId,
  quantity: 10,
  shipping: true,
  createdAt: new Date(Date.now() + 60000 + order * 1000),
  updatedAt: new Date(Date.now() + 60000 + order * 1000),
});

const getFirstHomeProduct = async (page) => {
  const firstCard = getHomeProductCards(page).first();
  const name =
    (await firstCard.locator(".card-title").first().textContent())?.trim() || "";
  const priceText =
    (await firstCard.locator(".card-price").textContent())?.trim() || "";

  return {
    name,
    price: parseCurrency(priceText),
  };
};

const seedCartBeforeNavigation = async (page, cartItems) => {
  await page.addInitScript((items) => {
    window.localStorage.setItem("cart", JSON.stringify(items));
  }, cartItems);
};

const seedAuthBeforeNavigation = async (page, authState) => {
  await page.addInitScript((auth) => {
    window.localStorage.setItem("auth", JSON.stringify(auth));
  }, authState);
};

const ensureLoggedInAddressBeforeNavigation = async (
  page,
  address = "123 Playwright Street",
) => {
  await page.addInitScript((nextAddress) => {
    const rawAuth = window.localStorage.getItem("auth");
    if (!rawAuth) return;

    const parsedAuth = JSON.parse(rawAuth);
    if (!parsedAuth?.token) return;

    parsedAuth.user = {
      ...(parsedAuth.user || {}),
      address: nextAddress,
    };

    window.localStorage.setItem("auth", JSON.stringify(parsedAuth));
  }, address);
};

const seedCheckoutHappyPathData = async () => {
  await ensureMongoConnection();

  const uniqueTag = `pw-checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const category = await categoryModel.create({
    name: `Checkout ${uniqueTag}`,
    slug: `checkout-${uniqueTag}`,
  });

  const products = await productModel.create([
    buildCheckoutSeededProduct({
      name: `Checkout Alpha ${uniqueTag}`,
      price: 24,
      categoryId: category._id,
      slugPrefix: uniqueTag,
      order: 1,
    }),
    buildCheckoutSeededProduct({
      name: `Checkout Beta ${uniqueTag}`,
      price: 31,
      categoryId: category._id,
      slugPrefix: uniqueTag,
      order: 2,
    }),
  ]);

  const sortedProducts = [...products].sort(
    (first, second) => second.createdAt.getTime() - first.createdAt.getTime(),
  );
  const buyer = await userModel.findOne({ email: "user@test.com" }).select("_id");

  return {
    buyerId: buyer?._id,
    categoryId: category._id,
    products: sortedProducts,
  };
};

const cleanupCheckoutHappyPathData = async ({
  buyerId,
  categoryId,
  productIds,
}) => {
  await ensureMongoConnection();
  await orderModel.deleteMany({
    buyer: buyerId,
    products: { $in: productIds },
  });
  await productModel.deleteMany({ _id: { $in: productIds } });
  await categoryModel.deleteOne({ _id: categoryId });
};

const getHomeProductCardByName = (page, productName) =>
  getHomeProductCards(page).filter({
    has: page.locator(".card-title", { hasText: productName }),
  });

const waitForPaymentResponse = (page) =>
  page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/product/braintree/payment") &&
      response.request().method() === "POST",
  );

const fillHostedField = async (page, iframeTitle, value) => {
  const iframeLocator = page.locator(`iframe[title="${iframeTitle}"]`);
  if ((await iframeLocator.count()) === 0) {
    return;
  }

  await iframeLocator.first().waitFor({ state: "visible", timeout: 30000 });
  await page
    .frameLocator(`iframe[title="${iframeTitle}"]`)
    .locator("input")
    .fill(value);
};

const fillBraintreeCardForm = async (page) => {
  const cardOption = page.locator("[data-braintree-id='wrapper'] .braintree-option__card");
  if ((await cardOption.count()) > 0) {
    await cardOption.first().click();
  }

  await fillHostedField(
    page,
    "Secure Credit Card Frame - Credit Card Number",
    "4242424242424242",
  );
  await fillHostedField(
    page,
    "Secure Credit Card Frame - Expiration Date",
    "12/34",
  );
  await fillHostedField(page, "Secure Credit Card Frame - CVV", "123");
  await fillHostedField(page, "Secure Credit Card Frame - Postal Code", "12345");
};

const goToSeededCartPage = async (page, cartItems = [guestCartProduct]) => {
  await seedCartBeforeNavigation(page, cartItems);
  await page.goto("/cart");
  await expect(page.locator(".cart-page")).toBeVisible();
};

const goToSeededAuthedCartPage = async (
  page,
  { cartItems = [guestCartProduct], authState = userWithoutAddressAuth } = {},
) => {
  await seedCartBeforeNavigation(page, cartItems);
  await seedAuthBeforeNavigation(page, authState);
  await page.goto("/cart");
  await expect(page.locator(".cart-page")).toBeVisible();
};

const expectCartToRemainIntact = async (page, cartItems) => {
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator(".cart-page")).toContainText(cartItems[0].name);
  await expect(getCartSummary(page).locator("h4")).toContainText(
    formatCurrency(cartItems.reduce((runningTotal, item) => runningTotal + item.price, 0)),
  );
  await expect(getCartBadge(page)).toHaveAttribute("title", String(cartItems.length));

  expect(await getStoredCartSnapshot(page)).toEqual(buildCartSnapshot(cartItems));
};

test.describe("Functional E2E", () => {
  test("guest shopper can add a product on the home page and see it in the cart page", async ({
    page,
  }) => {
    test.slow();

    await loadHomePage(page);

    const product = await getFirstHomeProduct(page);
    if (!product.name) {
      return test.skip();
    }

    const firstCard = getHomeProductCards(page).first();
    await firstCard.getByRole("button", { name: "ADD TO CART" }).click();
    await expect(getCartBadge(page)).toHaveAttribute("title", "1");

    await page.locator("a[href='/cart']").click();
    await expect(page).toHaveURL("/cart");

    await expect(page.locator(".cart-page")).toContainText(product.name);
    await expect(
      getCartSummary(page).getByRole("heading", { name: /cart summary/i }),
    ).toBeVisible();
    await expect(getCartSummary(page).locator("h4")).toContainText(
      formatCurrency(product.price),
    );
    await expect(getCartBadge(page)).toHaveAttribute("title", "1");
  });

  test("guest shopper can remove a product from the cart page", async ({
    page,
  }) => {
    await goToSeededCartPage(page);

    await getFirstCartItem(page).getByRole("button", { name: /remove/i }).click();
    await expect(page.locator(".cart-page")).toContainText("Your Cart Is Empty");
    await expect(getCartSummary(page).locator("h4")).toContainText("$0.00");
    await expect(getCartBadge(page)).toHaveAttribute("title", "0");
  });

  test("guest checkout redirects to login and returns with the cart preserved after login", async ({
    page,
  }) => {
    await goToSeededCartPage(page);

    await getCartSummary(page)
      .getByRole("button", { name: /login to checkout/i })
      .click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByPlaceholder("Enter Your Email ").fill("user@test.com");
    await page.getByPlaceholder("Enter Your Password").fill("user@test.com");
    await page.getByRole("button", { name: "LOGIN" }).click();

    await expect(page).toHaveURL("/cart");
    await expect(page.locator(".cart-page")).toContainText(guestCartProduct.name);
    await expect(getCartSummary(page).locator("h4")).toContainText(
      formatCurrency(guestCartProduct.price),
    );
    await expect(getCartBadge(page)).toHaveAttribute("title", "1");
  });

  test.use({ storageState: "playwright/.user.auth.json" });

  test("logged-in shopper sees the Braintree checkout section when the cart has items", async ({
    page,
  }) => {
    test.slow();

    await goToSeededCartPage(page);

    await expect(page.getByRole("heading", { name: /cart summary/i })).toBeVisible();
    await expect(page.getByText(/current address/i)).toBeVisible();
    await expect(page.locator("[data-braintree-id='wrapper']")).toBeVisible({
      timeout: 15000,
    });
    await expect(
      getCartSummary(page).getByRole("button", { name: /make payment/i }),
    ).toBeVisible();
  });

  test("logged-in shopper keeps the cart when the Braintree token request fails", async ({
    page,
  }) => {
    await page.route("**/api/v1/product/braintree/token", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "token generation failed" }),
      });
    });

    await ensureLoggedInAddressBeforeNavigation(page);
    await goToSeededCartPage(page);

    await expect(page.getByText(/current address/i)).toBeVisible();
    await expect(page.locator("[data-braintree-id='wrapper']")).toHaveCount(0);
    await expect(
      getCartSummary(page).getByRole("button", { name: /make payment/i }),
    ).toHaveCount(0);
    await expectCartToRemainIntact(page, [guestCartProduct]);
  });

  test("logged-in shopper keeps the cart when requesting a payment method fails", async ({
    page,
  }) => {
    let paymentApiCalls = 0;

    await page.route("**/api/v1/product/braintree/payment", async (route) => {
      paymentApiCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await ensureLoggedInAddressBeforeNavigation(page);
    await goToSeededCartPage(page);

    await expect(page.locator("[data-braintree-id='wrapper']")).toBeVisible({
      timeout: 30000,
    });

    const makePaymentButton = getCartSummary(page).getByRole("button", {
      name: /make payment/i,
    });
    await makePaymentButton.click();
    await expect(makePaymentButton).toHaveText(/make payment/i, {
      timeout: 15000,
    });

    expect(paymentApiCalls).toBe(0);
    await expectCartToRemainIntact(page, [guestCartProduct]);
  });

  test("logged-in shopper keeps the cart when the payment API rejects the checkout", async ({
    page,
  }) => {
    const cartItems = [guestCartProduct];

    await page.route("**/api/v1/product/braintree/payment", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "payment failed" }),
      });
    });

    await ensureLoggedInAddressBeforeNavigation(page);
    await goToSeededCartPage(page, cartItems);

    await expect(page.locator("[data-braintree-id='wrapper']")).toBeVisible({
      timeout: 30000,
    });
    await fillBraintreeCardForm(page);

    const paymentResponsePromise = waitForPaymentResponse(page);
    const makePaymentButton = getCartSummary(page).getByRole("button", {
      name: /make payment/i,
    });
    await makePaymentButton.click();
    const paymentResponse = await paymentResponsePromise;

    expect(paymentResponse.status()).toBe(500);
    await expect(makePaymentButton).toHaveText(/make payment/i, {
      timeout: 15000,
    });
    await expectCartToRemainIntact(page, cartItems);
  });

  test("logged-in shopper can complete payment and later see the purchased items on the orders page", async ({
    page,
  }) => {
    test.slow();

    const seededData = await seedCheckoutHappyPathData();

    try {
      await ensureLoggedInAddressBeforeNavigation(page);
      await loadHomePage(page);

      for (const product of seededData.products) {
        const productCard = getHomeProductCardByName(page, product.name);
        await expect(productCard).toHaveCount(1, { timeout: 10000 });
        await productCard.getByRole("button", { name: "ADD TO CART" }).click();
      }

      await expect(getCartBadge(page)).toHaveAttribute(
        "title",
        String(seededData.products.length),
      );

      await page.locator("a[href='/cart']").click();
      await expect(page).toHaveURL("/cart");
      await expect(getCartSummary(page).locator("h4")).toContainText(
        formatCurrency(
          seededData.products.reduce(
            (runningTotal, product) => runningTotal + product.price,
            0,
          ),
        ),
      );

      await expect(page.locator("[data-braintree-id='wrapper']")).toBeVisible({
        timeout: 30000,
      });
      await fillBraintreeCardForm(page);

      const paymentResponsePromise = waitForPaymentResponse(page);
      await getCartSummary(page)
        .getByRole("button", { name: /make payment/i })
        .click();
      const paymentResponse = await paymentResponsePromise;
      expect(paymentResponse.ok()).toBeTruthy();

      await expect(page).toHaveURL(/\/dashboard\/user\/orders$/, {
        timeout: 60000,
      });
      await expect(page.getByRole("heading", { name: /all orders/i })).toBeVisible();
      expect(await page.evaluate(() => window.localStorage.getItem("cart"))).toBeNull();
      await expect(getCartBadge(page)).toHaveAttribute("title", "0");

      for (const product of seededData.products) {
        await expect(page.locator(".dashboard")).toContainText(product.name, {
          timeout: 60000,
        });
      }

      await expect(page.locator(".dashboard")).toContainText(
        `Price : ${seededData.products[0].price}`,
      );
      await expect(page.locator(".dashboard")).toContainText(
        `Price : ${seededData.products[1].price}`,
      );

      const orderRows = getOrdersTables(page).locator("tbody tr");
      const orderCount = await orderRows.count();
      expect(orderCount).toBeGreaterThan(0);
    } finally {
      await cleanupCheckoutHappyPathData({
        buyerId: seededData.buyerId,
        categoryId: seededData.categoryId,
        productIds: seededData.products.map((product) => product._id),
      });
    }
  });

  test("logged-in shopper without an address sees Update Address and cannot reach payment", async ({
    page,
  }) => {
    await goToSeededAuthedCartPage(page);

    await expect(
      getCartSummary(page).getByRole("button", { name: /update address/i }),
    ).toBeVisible();
    await expect(
      getCartSummary(page).getByRole("button", { name: /make payment/i }),
    ).toHaveCount(0);
    await expect(page.locator("[data-braintree-id='wrapper']")).toHaveCount(0);
  });
});

test.describe("UI test", () => {
  test("shows the guest cart summary and checkout prompt when a guest has cart items", async ({
    page,
  }) => {
    await goToSeededCartPage(page);

    await expect(page.getByRole("heading", { name: /hello guest/i })).toBeVisible();
    await expect(page.locator(".cart-page")).toContainText("You Have 1 items in your cart");
    await expect(getCartSummary(page).getByRole("heading", { name: /cart summary/i })).toBeVisible();
    await expect(getCartSummary(page)).toContainText("Total | Checkout | Payment");
    await expect(
      getCartSummary(page).getByRole("button", { name: /login to checkout/i }),
    ).toBeVisible();
  });

  test("shows each cart item with image, name, price, and remove action", async ({
    page,
  }) => {
    await goToSeededCartPage(page);

    const firstCartItem = getFirstCartItem(page);
    await expect(firstCartItem).toBeVisible();
    await expect(firstCartItem.locator("img.card-img-top")).toBeVisible();
    await expect(firstCartItem).toContainText(guestCartProduct.name);
    await expect(firstCartItem).toContainText(`Price : ${guestCartProduct.price}`);
    await expect(firstCartItem.getByRole("button", { name: /remove/i })).toBeVisible();
  });

  test("shows the empty-cart state and zero total when the cart has no items", async ({
    page,
  }) => {
    await goToSeededCartPage(page, []);

    await expect(page.locator(".cart-page")).toContainText("Your Cart Is Empty");
    await expect(getCartSummary(page).getByRole("heading", { name: /cart summary/i })).toBeVisible();
    await expect(getCartSummary(page).locator("h4")).toContainText("$0.00");
    await expect(getCartBadge(page)).toHaveAttribute("title", "0");
  });
});
