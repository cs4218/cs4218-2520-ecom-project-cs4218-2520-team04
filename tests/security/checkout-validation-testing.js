import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

import productRoutes from "../../routes/productRoutes.js";
import productModel from "../../models/productModel.js";
import categoryModel from "../../models/categoryModel.js";
import orderModel from "../../models/orderModel.js";
import userModel from "../../models/userModel.js";

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

process.env.JWT_SECRET = "test-jwt-secret-checkout-security";

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
  jest.spyOn(console, "log").mockImplementation(() => {});

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(express.json());
  app.use("/api/v1/product", productRoutes);
});

beforeEach(() => {
  getMockBraintreeGateway().clientToken.generate.mockReset();
  getMockBraintreeGateway().transaction.sale.mockReset();
});

afterEach(async () => {
  await orderModel.deleteMany({});
  await productModel.deleteMany({});
  await categoryModel.deleteMany({});
  await userModel.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});

const seedShopper = async () => {
  const shopper = await userModel.create({
    name: "Checkout Security Shopper",
    email: "checkout-security-shopper@test.com",
    password: "StrongPass1!",
    phone: "80000011",
    address: "11 Checkout Street",
    answer: "checkout-security-answer",
    role: 0,
  });

  const token = jwt.sign({ _id: shopper._id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  return { shopper, token };
};

const seedCheckoutProduct = async ({
  name = "Secure Laptop",
  slug = "secure-laptop",
  price = 120,
  quantity = 5,
} = {}) => {
  const category = await categoryModel.create({
    name: `${name} Category`,
    slug: `${slug}-category`,
  });

  return productModel.create({
    name,
    slug,
    description: `${name} description`,
    price,
    category: category._id,
    quantity,
  });
};

describe("Checkout validation security testing", () => {
  test("recalculates payment amount on the server even when the client tampers with price fields", async () => {
    const { shopper, token } = await seedShopper();
    const product = await seedCheckoutProduct({ price: 120, quantity: 5 });
    const paymentResponse = {
      transaction: { id: "txn-secure-price", status: "submitted" },
    };

    getMockBraintreeGateway().transaction.sale.mockImplementationOnce(
      (payload, callback) => callback(null, paymentResponse)
    );

    const response = await request(app)
      .post("/api/v1/product/braintree/payment")
      .set("Authorization", token)
      .send({
        nonce: "tampered-price-nonce",
        cart: [
          {
            _id: product._id.toString(),
            price: 0.01,
            quantity: 1,
          },
        ],
      });

    const savedOrder = await waitForOrderByBuyer(shopper._id);
    const refreshedProduct = await productModel.findById(product._id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(getMockBraintreeGateway().transaction.sale).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 120,
        paymentMethodNonce: "tampered-price-nonce",
      }),
      expect.any(Function)
    );
    expect(savedOrder).not.toBeNull();
    expect(savedOrder.products.map((productId) => productId.toString())).toEqual([
      product._id.toString(),
    ]);
    expect(refreshedProduct.quantity).toBe(4);
  });

  test("rejects tampered quantities that exceed current stock before creating an order", async () => {
    const { token } = await seedShopper();
    const product = await seedCheckoutProduct({ price: 75, quantity: 2 });

    const response = await request(app)
      .post("/api/v1/product/braintree/payment")
      .set("Authorization", token)
      .send({
        nonce: "tampered-quantity-nonce",
        cart: [
          {
            _id: product._id.toString(),
            price: 75,
            quantity: 99,
          },
        ],
      });

    const orderCount = await orderModel.countDocuments({});
    const refreshedProduct = await productModel.findById(product._id);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: "One or more products are out of stock",
    });
    expect(orderCount).toBe(0);
    expect(refreshedProduct.quantity).toBe(2);
    expect(getMockBraintreeGateway().transaction.sale).not.toHaveBeenCalled();
  });

  test("uses the latest server-side stock level when the client submits stale checkout data", async () => {
    const { token } = await seedShopper();
    const product = await seedCheckoutProduct({ price: 50, quantity: 3 });

    await productModel.findByIdAndUpdate(product._id, { quantity: 1 });

    const response = await request(app)
      .post("/api/v1/product/braintree/payment")
      .set("Authorization", token)
      .send({
        nonce: "stale-stock-nonce",
        cart: [
          {
            _id: product._id.toString(),
            price: 50,
            quantity: 2,
          },
        ],
      });

    const refreshedProduct = await productModel.findById(product._id);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: "One or more products are out of stock",
    });
    expect(refreshedProduct.quantity).toBe(1);
    expect(getMockBraintreeGateway().transaction.sale).not.toHaveBeenCalled();
  });
});
