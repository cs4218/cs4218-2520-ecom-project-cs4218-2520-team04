//
// Tan Wei Lian, A0269750U
//
// Integration tests for product routes + controller + middleware + model.
// Tests go through the full HTTP stack using supertest:
//   route -> requireSignIn -> isAdmin -> formidable -> productController -> productModel/categoryModel/orderModel
// This verifies:
//   - Auth middleware blocks unauthenticated / non-admin requests on protected routes
//   - formidable correctly parses multipart form data (fields + file upload)
//   - Cross-model validation: category existence check, order association check

import mongoose from "mongoose";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import productRoutes from "../../../../routes/productRoutes.js";
import productModel from "../../../../models/productModel.js";
import categoryModel from "../../../../models/categoryModel.js";
import orderModel from "../../../../models/orderModel.js";
import userModel from "../../../../models/userModel.js";

// Use a fixed test secret so auth middleware and token signing agree
process.env.JWT_SECRET = "test-jwt-secret-integration";

// Suppress console.log from middleware (expected JWT errors in auth tests)
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  getMockBraintreeGateway().clientToken.generate.mockReset();
  getMockBraintreeGateway().transaction.sale.mockReset();
});

// Mock only braintree (external payment gateway - not under test)
jest.mock("braintree", () => {
  const gateway = {
    clientToken: { generate: jest.fn() },
    transaction: { sale: jest.fn() },
  };

  return {
    BraintreeGateway: jest.fn().mockImplementation(() => gateway),
    Environment: { Sandbox: "sandbox" },
    __mockGateway: gateway,
  };
});

// Minimal JPEG bytes for photo upload tests
const TEST_PHOTO_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const getMockBraintreeGateway = () => {
  const { __mockGateway } = jest.requireMock("braintree");
  return __mockGateway;
};

const waitForOrderByBuyer = async (buyerId, timeoutMs = 1000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const order = await orderModel.findOne({ buyer: buyerId });
    if (order) {
      return order;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return orderModel.findOne({ buyer: buyerId });
};

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Minimal Express app - only product routes (includes formidable middleware)
  app = express();
  app.use(express.json());
  app.use("/api/v1/product", productRoutes);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await productModel.deleteMany({});
  await categoryModel.deleteMany({});
  await orderModel.deleteMany({});
});

// --- Auth middleware integration ------------------------------------------------

// Tan Wei Lian, A0269750U
describe("Auth middleware - protected product routes", () => {
  test("POST /create-product returns 401 with no Authorization header", async () => {
    const res = await request(app)
      .post("/api/v1/product/create-product")
      .field("name", "Laptop");

    expect(res.status).toBe(401);
  });

  test("PUT /update-product/:pid returns 401 with an invalid token", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/v1/product/update-product/${fakeId}`)
      .set("Authorization", "bad-token")
      .field("name", "Laptop");

    expect(res.status).toBe(401);
  });

  test("DELETE /delete-product/:pid returns 401 with no Authorization header", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).delete(
      `/api/v1/product/delete-product/${fakeId}`,
    );

    expect(res.status).toBe(401);
  });
});

// Teo Kai Xiang, A0272558U
describe("GET /api/v1/product/braintree/token", () => {
  describe("failure path", () => {
    test("rejects an unauthenticated request", async () => {
      // Summary: Verifies the token route is protected and rejects requests without a JWT.
      // Flow: call token endpoint without Authorization header -> assert 401 status and auth error body.
      // Arrange

      // Act
      const res = await request(app).get("/api/v1/product/braintree/token");

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: "Invalid or expired token",
      });
    });

    describe("authenticated request where the gateway returns an error", () => {
      let shopper;
      let shopperToken;

      beforeAll(async () => {
        shopper = await userModel.create({
          name: "Token Failure Shopper",
          email: "token-failure-shopper@test.com",
          password: "pass123",
          phone: "80000002",
          address: "2 Token Street",
          answer: "token-failure-answer",
          role: 0,
        });
        shopperToken = jwt.sign({ _id: shopper._id }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });
      });

      afterAll(async () => {
        await userModel.deleteOne({ email: "token-failure-shopper@test.com" });
      });

      test("returns 500 when Braintree client token generation fails for an authenticated user", async () => {
        // Summary: Verifies gateway token-generation failures are surfaced to authenticated clients.
        // Flow: seed shopper and JWT -> force mocked Braintree token generation error -> call token endpoint -> assert 500 response body.
        // Arrange
        const errorResponse = { message: "token generation failed" };
        getMockBraintreeGateway().clientToken.generate.mockImplementationOnce(
          (payload, callback) => callback(errorResponse, null),
        );

        // Act
        const res = await request(app)
          .get("/api/v1/product/braintree/token")
          .set("Authorization", shopperToken);

        // Assert
        expect(res.status).toBe(500);
        expect(res.body).toEqual(errorResponse);
      });
    });
  });

  describe("success path", () => {
    describe("authenticated request where the gateway returns a token", () => {
      let shopper;
      let shopperToken;

      beforeAll(async () => {
        shopper = await userModel.create({
          name: "Token Shopper",
          email: "token-shopper@test.com",
          password: "pass123",
          phone: "80000001",
          address: "1 Token Street",
          answer: "token-answer",
          role: 0,
        });
        shopperToken = jwt.sign({ _id: shopper._id }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });
      });

      afterAll(async () => {
        await userModel.deleteOne({ email: "token-shopper@test.com" });
      });

      test("forwards the generated client token response as-is", async () => {
        // Summary: Verifies a successful Braintree token response is forwarded unchanged by the route.
        // Flow: seed shopper and JWT -> mock successful client token generation -> call token endpoint -> assert 200 body and gateway invocation.
        // Arrange
        const responseObj = { clientToken: "token-123" };
        getMockBraintreeGateway().clientToken.generate.mockImplementationOnce(
          (payload, callback) => callback(null, responseObj),
        );

        // Act
        const res = await request(app)
          .get("/api/v1/product/braintree/token")
          .set("Authorization", shopperToken);

        // Assert
        expect(res.status).toBe(200);
        expect(res.body).toEqual(responseObj);
        expect(
          getMockBraintreeGateway().clientToken.generate,
        ).toHaveBeenCalledWith({}, expect.any(Function));
      });
    });
  });
});

// Teo Kai Xiang, A0272558U
describe("POST /api/v1/product/braintree/payment", () => {
  describe("failure path", () => {
    test("rejects an unauthenticated request and does not persist an order", async () => {
      // Summary: Verifies the payment route is protected and cannot create orders for guests.
      // Flow: seed category and product -> POST payment without JWT -> assert 401 response and unchanged order count.
      // Arrange
      const category = await categoryModel.create({
        name: "Electronics",
        slug: "electronics",
      });
      const product = await productModel.create({
        name: "Laptop",
        slug: "laptop",
        description: "A fast laptop",
        price: 999,
        category: category._id,
        quantity: 3,
      });
      const orderCountBeforeRequest = await orderModel.countDocuments({});

      // Act
      const res = await request(app)
        .post("/api/v1/product/braintree/payment")
        .send({
          nonce: "fake-valid-nonce",
          cart: [
            {
              _id: product._id.toString(),
              name: product.name,
              price: product.price,
              quantity: 1,
            },
          ],
        });

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: "Invalid or expired token",
      });
      expect(await orderModel.countDocuments({})).toBe(orderCountBeforeRequest);
    });

    describe("authenticated request where the gateway returns an error", () => {
      let shopper;
      let shopperToken;
      let product;

      beforeAll(async () => {
        shopper = await userModel.create({
          name: "Payment Failure Shopper",
          email: "payment-failure-shopper@test.com",
          password: "pass123",
          phone: "80000004",
          address: "4 Payment Street",
          answer: "payment-failure-answer",
          role: 0,
        });
        shopperToken = jwt.sign({ _id: shopper._id }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });
      });

      afterAll(async () => {
        await userModel.deleteOne({
          email: "payment-failure-shopper@test.com",
        });
      });

      beforeEach(async () => {
        const category = await categoryModel.create({
          name: "Checkout Failure",
          slug: "checkout-failure",
        });
        product = await productModel.create({
          name: "Keyboard",
          slug: "keyboard",
          description: "A mechanical keyboard",
          price: 80,
          category: category._id,
          quantity: 7,
        });
      });

      test("returns 500 and does not persist an order when Braintree sale fails", async () => {
        // Summary: Verifies payment-gateway sale failures do not create partial order data.
        // Flow: seed shopper, JWT, category, and product -> force mocked sale failure -> POST payment -> assert 500 response and unchanged order count.
        // Arrange
        const errorResponse = { message: "payment failed" };
        const orderCountBeforeRequest = await orderModel.countDocuments({});
        getMockBraintreeGateway().transaction.sale.mockImplementationOnce(
          (payload, callback) => callback(errorResponse, null),
        );

        // Act
        const res = await request(app)
          .post("/api/v1/product/braintree/payment")
          .set("Authorization", shopperToken)
          .send({
            nonce: "nonce-fail",
            cart: [{ _id: product._id.toString(), price: product.price }],
          });

        // Assert
        expect(res.status).toBe(500);
        expect(res.body).toEqual(errorResponse);
        expect(await orderModel.countDocuments({})).toBe(
          orderCountBeforeRequest,
        );
      });
    });
  });

  describe("success path", () => {
    describe("authenticated request where the gateway approves the payment", () => {
      let shopper;
      let shopperToken;
      let firstProduct;
      let secondProduct;

      beforeAll(async () => {
        shopper = await userModel.create({
          name: "Payment Shopper",
          email: "payment-shopper@test.com",
          password: "pass123",
          phone: "80000003",
          address: "3 Payment Street",
          answer: "payment-answer",
          role: 0,
        });
        shopperToken = jwt.sign({ _id: shopper._id }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });
      });

      afterAll(async () => {
        await userModel.deleteOne({ email: "payment-shopper@test.com" });
      });

      beforeEach(async () => {
        const category = await categoryModel.create({
          name: "Checkout",
          slug: "checkout",
        });
        [firstProduct, secondProduct] = await productModel.create([
          {
            name: "Laptop",
            slug: "laptop",
            description: "A fast laptop",
            price: 10,
            category: category._id,
            quantity: 3,
          },
          {
            name: "Mouse",
            slug: "mouse",
            description: "A wireless mouse",
            price: 15,
            category: category._id,
            quantity: 5,
          },
        ]);
      });

      test("returns ok true and persists an order with products, payment, and buyer", async () => {
        // Summary: Verifies successful payment persists the complete order document with buyer, products, and payment payload.
        // Flow: seed shopper, JWT, and products -> mock successful sale -> POST payment -> wait for saved order -> assert response and persisted order fields.
        // Arrange
        const cart = [
          { _id: firstProduct._id.toString(), price: firstProduct.price },
          { _id: secondProduct._id.toString(), price: secondProduct.price },
        ];
        const resultObj = { transaction: { id: "txn-1", status: "submitted" } };
        const orderCountBeforeRequest = await orderModel.countDocuments({});
        getMockBraintreeGateway().transaction.sale.mockImplementationOnce(
          (payload, callback) => callback(null, resultObj),
        );

        // Act
        const res = await request(app)
          .post("/api/v1/product/braintree/payment")
          .set("Authorization", shopperToken)
          .send({
            nonce: "nonce-123",
            cart,
          });
        const savedOrder = await waitForOrderByBuyer(shopper._id);

        // Assert
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
        expect(await orderModel.countDocuments({})).toBe(
          orderCountBeforeRequest + 1,
        );
        expect(savedOrder).not.toBeNull();
        expect(
          savedOrder.products.map((productId) => productId.toString()),
        ).toEqual([firstProduct._id.toString(), secondProduct._id.toString()]);
        expect(savedOrder.payment).toEqual(resultObj);
        expect(savedOrder.buyer.toString()).toBe(shopper._id.toString());
      });
    });
  });
});

// Teo Kai Xiang, A0272558U
describe("Complete Braintree route flow - token to payment", () => {
  let shopper;
  let shopperToken;
  let firstProduct;
  let secondProduct;

  beforeAll(async () => {
    shopper = await userModel.create({
      name: "Flow Shopper",
      email: "flow-shopper@test.com",
      password: "pass123",
      phone: "80000006",
      address: "6 Payment Street",
      answer: "flow-answer",
      role: 0,
    });
    shopperToken = jwt.sign({ _id: shopper._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
  });

  afterAll(async () => {
    await userModel.deleteOne({ email: "flow-shopper@test.com" });
  });

  beforeEach(async () => {
    const category = await categoryModel.create({
      name: "Flow Checkout",
      slug: "flow-checkout",
    });
    [firstProduct, secondProduct] = await productModel.create([
      {
        name: "Phone",
        slug: "phone",
        description: "A test phone",
        price: 20,
        category: category._id,
        quantity: 3,
      },
      {
        name: "Case",
        slug: "case",
        description: "A test case",
        price: 5,
        category: category._id,
        quantity: 7,
      },
    ]);
  });

  test("gets a client token first, then completes payment and creates an order", async () => {
    // Summary: Verifies the full backend checkout sequence from token retrieval to successful order creation.
    // Flow: seed shopper, JWT, category, and products -> mock token generation -> mock payment approval -> GET token -> POST payment -> assert saved order.
    // Arrange
    const tokenResponse = { clientToken: "sandbox-client-token-4242" };
    const paymentResponse = {
      transaction: { id: "txn-flow", status: "submitted" },
    };
    const cart = [
      { _id: firstProduct._id.toString(), price: firstProduct.price },
      { _id: secondProduct._id.toString(), price: secondProduct.price },
    ];
    const orderCountBeforeRequest = await orderModel.countDocuments({});

    getMockBraintreeGateway().clientToken.generate.mockImplementationOnce(
      (payload, callback) => callback(null, tokenResponse),
    );
    getMockBraintreeGateway().transaction.sale.mockImplementationOnce(
      (payload, callback) => callback(null, paymentResponse),
    );

    // Act
    const tokenRes = await request(app)
      .get("/api/v1/product/braintree/token")
      .set("Authorization", shopperToken);

    // In the real browser flow, a sandbox card like 4242 4242 4242 4242 would be
    // entered into Braintree DropIn, which would exchange it for a nonce. At this
    // backend route layer we simulate only the post-DropIn step by sending a nonce.
    const paymentRes = await request(app)
      .post("/api/v1/product/braintree/payment")
      .set("Authorization", shopperToken)
      .send({
        nonce: "nonce-generated-from-sandbox-4242-card",
        cart,
      });
    const savedOrder = await waitForOrderByBuyer(shopper._id);

    // Assert
    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body).toEqual(tokenResponse);
    expect(paymentRes.status).toBe(200);
    expect(paymentRes.body).toEqual({ ok: true });
    expect(await orderModel.countDocuments({})).toBe(
      orderCountBeforeRequest + 1,
    );
    expect(savedOrder).not.toBeNull();
    expect(
      savedOrder.products.map((productId) => productId.toString()),
    ).toEqual([firstProduct._id.toString(), secondProduct._id.toString()]);
    expect(savedOrder.payment).toEqual(paymentResponse);
    expect(savedOrder.buyer.toString()).toBe(shopper._id.toString());
  });
});

// --- Admin product CRUD ---------------------------------------------------------

// Tan Wei Lian, A0269750U
describe("Product CRUD - admin authenticated requests via full HTTP stack", () => {
  let adminToken;
  let testCategory;

  beforeAll(async () => {
    const admin = await userModel.create({
      name: "Admin",
      email: "admin-product@test.com",
      password: "admin123",
      phone: "77777777",
      address: "1 Admin Ave",
      answer: "answer",
      role: 1,
    });
    adminToken = jwt.sign({ _id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
  });

  afterAll(async () => {
    await userModel.deleteOne({ email: "admin-product@test.com" });
  });

  beforeEach(async () => {
    testCategory = await categoryModel.create({
      name: "Electronics",
      slug: "electronics",
    });
  });

  describe("POST /api/v1/product/create-product", () => {
    test("creates a product and persists it in the real DB when category exists", async () => {
      const res = await request(app)
        .post("/api/v1/product/create-product")
        .set("Authorization", adminToken)
        .field("name", "Laptop")
        .field("description", "A fast laptop")
        .field("price", "999")
        .field("category", testCategory._id.toString())
        .field("quantity", "3")
        .field("shipping", "1")
        .attach("photo", TEST_PHOTO_BUFFER, {
          filename: "photo.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.products.name).toBe("Laptop");

      // Verify real DB write
      const saved = await productModel.findOne({ name: "Laptop" });
      expect(saved).not.toBeNull();
      expect(saved.category.toString()).toBe(testCategory._id.toString());
      expect(saved.photo.data).toBeTruthy();
    });

    test("returns 404 when the category ID does not exist in the real DB", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post("/api/v1/product/create-product")
        .set("Authorization", adminToken)
        .field("name", "Widget")
        .field("description", "A widget")
        .field("price", "10")
        .field("category", fakeId.toString())
        .field("quantity", "5")
        .attach("photo", TEST_PHOTO_BUFFER, {
          filename: "photo.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Category not found");

      // Nothing should have been saved
      expect(await productModel.countDocuments({})).toBe(0);
    });

    test("returns 400 when required fields are missing (name)", async () => {
      const res = await request(app)
        .post("/api/v1/product/create-product")
        .set("Authorization", adminToken)
        .field("description", "No name")
        .field("price", "5")
        .field("category", testCategory._id.toString())
        .field("quantity", "1")
        .attach("photo", TEST_PHOTO_BUFFER, {
          filename: "photo.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Name is Required");
    });

    test("returns 400 when photo is missing", async () => {
      const res = await request(app)
        .post("/api/v1/product/create-product")
        .set("Authorization", adminToken)
        .field("name", "No Photo Product")
        .field("description", "Missing photo")
        .field("price", "10")
        .field("category", testCategory._id.toString())
        .field("quantity", "1");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Photo is Required");
    });
  });

  describe("PUT /api/v1/product/update-product/:pid", () => {
    test("updates the product in the real DB and returns 200", async () => {
      // Seed a product directly
      const product = await productModel.create({
        name: "OldLaptop",
        slug: "old-laptop",
        description: "Old desc",
        price: 800,
        category: testCategory._id,
        quantity: 2,
      });

      const res = await request(app)
        .put(`/api/v1/product/update-product/${product._id}`)
        .set("Authorization", adminToken)
        .field("name", "NewLaptop")
        .field("description", "New desc")
        .field("price", "850")
        .field("category", testCategory._id.toString())
        .field("quantity", "4");

      expect(res.status).toBe(200);
      expect(res.body.products.name).toBe("NewLaptop");

      // Verify real DB update
      const updated = await productModel.findById(product._id);
      expect(updated.name).toBe("NewLaptop");
      expect(updated.price).toBe(850);
    });

    test("returns 404 when product ID does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .put(`/api/v1/product/update-product/${fakeId}`)
        .set("Authorization", adminToken)
        .field("name", "Ghost")
        .field("description", "Ghost desc")
        .field("price", "1")
        .field("category", testCategory._id.toString())
        .field("quantity", "1");

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Product not found");
    });

    test("returns 404 when updated category does not exist in the real DB", async () => {
      const product = await productModel.create({
        name: "Tablet",
        slug: "tablet",
        description: "A tablet",
        price: 400,
        category: testCategory._id,
        quantity: 5,
      });

      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/v1/product/update-product/${product._id}`)
        .set("Authorization", adminToken)
        .field("name", "Tablet")
        .field("description", "A tablet")
        .field("price", "400")
        .field("category", fakeId.toString())
        .field("quantity", "5");

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Category not found");
    });
  });

  describe("DELETE /api/v1/product/delete-product/:pid", () => {
    test("deletes the product from the real DB and returns 200", async () => {
      const product = await productModel.create({
        name: "Headphones",
        slug: "headphones",
        description: "Wireless headphones",
        price: 50,
        category: testCategory._id,
        quantity: 10,
      });

      const res = await request(app)
        .delete(`/api/v1/product/delete-product/${product._id}`)
        .set("Authorization", adminToken);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Product Deleted successfully");
      expect(await productModel.findById(product._id)).toBeNull();
    });

    test("returns 401 when non-admin user attempts to delete a product", async () => {
      const nonAdmin = await userModel.create({
        name: "User",
        email: "nonadmin-delete@test.com",
        password: "pass",
        phone: "11111111",
        address: "1 St",
        answer: "ans",
        role: 0,
      });
      const nonAdminToken = jwt.sign(
        { _id: nonAdmin._id },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
      );
      const product = await productModel.create({
        name: "Camera",
        slug: "camera",
        description: "DSLR",
        price: 500,
        category: testCategory._id,
        quantity: 2,
      });

      const res = await request(app)
        .delete(`/api/v1/product/delete-product/${product._id}`)
        .set("Authorization", nonAdminToken);

      expect(res.status).toBe(401);
      await userModel.deleteOne({ email: "nonadmin-delete@test.com" });
    });

    test("returns 400 when a real order references the product (cross-model check via HTTP)", async () => {
      const product = await productModel.create({
        name: "Keyboard",
        slug: "keyboard",
        description: "Mechanical keyboard",
        price: 80,
        category: testCategory._id,
        quantity: 7,
      });

      // Create real order referencing this product
      await orderModel.create({
        products: [product._id],
        payment: {},
        status: "Not Process",
      });

      const res = await request(app)
        .delete(`/api/v1/product/delete-product/${product._id}`)
        .set("Authorization", adminToken);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Cannot delete product associated with orders",
      );

      // Product must still exist
      expect(await productModel.findById(product._id)).not.toBeNull();
    });

    test("returns 404 when the product ID does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/v1/product/delete-product/${fakeId}`)
        .set("Authorization", adminToken);

      expect(res.status).toBe(404);
    });
  });

  describe("GET public endpoints (no auth required)", () => {
    test("GET /get-product returns all products with populated category", async () => {
      await productModel.create({
        name: "Mouse",
        slug: "mouse",
        description: "Wireless mouse",
        price: 30,
        category: testCategory._id,
        quantity: 20,
      });

      const res = await request(app).get("/api/v1/product/get-product");

      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].category.name).toBe("Electronics");
    });

    test("GET /get-product/:slug returns single product by slug", async () => {
      await productModel.create({
        name: "Monitor",
        slug: "monitor",
        description: "4K monitor",
        price: 300,
        category: testCategory._id,
        quantity: 5,
      });

      const res = await request(app).get("/api/v1/product/get-product/monitor");

      expect(res.status).toBe(200);
      expect(res.body.product.name).toBe("Monitor");
    });
  });
});

// Tan Wei Lian, A0269750U
describe("Full product lifecycle via HTTP stack - create -> update -> delete", () => {
  let adminToken;
  let category;

  beforeAll(async () => {
    const admin = await userModel.create({
      name: "Lifecycle Admin",
      email: "lifecycle@test.com",
      password: "pass",
      phone: "66666666",
      address: "2 Lifecycle St",
      answer: "ans",
      role: 1,
    });
    adminToken = jwt.sign({ _id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
  });

  afterAll(async () => {
    await userModel.deleteOne({ email: "lifecycle@test.com" });
  });

  beforeEach(async () => {
    category = await categoryModel.create({
      name: "Clothing",
      slug: "clothing",
    });
  });

  test("create -> update -> delete through full HTTP + middleware + DB", async () => {
    // Step 1: Create
    const createRes = await request(app)
      .post("/api/v1/product/create-product")
      .set("Authorization", adminToken)
      .field("name", "T-Shirt")
      .field("description", "Cotton t-shirt")
      .field("price", "19")
      .field("category", category._id.toString())
      .field("quantity", "20")
      .attach("photo", TEST_PHOTO_BUFFER, {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });
    expect(createRes.status).toBe(201);
    const productId = createRes.body.products._id;

    // Step 2: Verify in public GET list
    const listRes = await request(app).get("/api/v1/product/get-product");
    expect(
      listRes.body.products.find((p) => p._id === productId),
    ).toBeDefined();

    // Step 3: Update name
    const updateRes = await request(app)
      .put(`/api/v1/product/update-product/${productId}`)
      .set("Authorization", adminToken)
      .field("name", "Polo Shirt")
      .field("description", "Cotton polo shirt")
      .field("price", "25")
      .field("category", category._id.toString())
      .field("quantity", "15");
    expect(updateRes.status).toBe(200);
    expect((await productModel.findById(productId)).name).toBe("Polo Shirt");

    // Step 4: Delete
    const deleteRes = await request(app)
      .delete(`/api/v1/product/delete-product/${productId}`)
      .set("Authorization", adminToken);
    expect(deleteRes.status).toBe(200);
    expect(await productModel.findById(productId)).toBeNull();
  });
});
