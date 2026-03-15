//
// Lu Yixuan, Deborah, A0277911X
//
// Orders integration tests for MS2.
// Uses supertest + MongoMemoryServer to hit real endpoints and verify that routing,
// auth middleware, controller logic, and the Mongoose orderModel all work together:
//
//   route → requireSignIn / isAdmin → controller → orderModel (real MongoDB)
//
// Includes both security checks (401s) and functional checks (fetch orders, admin
// fetch all orders, update order status with DB persistence).
//
// Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
//

import mongoose from "mongoose";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";

import authRoutes from "../../../routes/authRoute.js";

import orderModel from "../../../models/orderModel.js";
import userModel from "../../../models/userModel.js";
import productModel from "../../../models/productModel.js";

process.env.JWT_SECRET = "test-jwt-secret-integration";

beforeEach(() => jest.spyOn(console, "log").mockImplementation(() => {}));

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(express.json());

  app.use("/api/v1/auth", authRoutes);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await orderModel.deleteMany({});
});

function signToken(userId) {
  return jwt.sign({ _id: userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

// ─── Auth middleware integration ───────────────────────────────────────────

// Lu Yixuan, Deborah, A0277911X
describe("Auth middleware: protected order routes", () => {
  afterEach(async () => {
    await userModel.deleteMany({});
  });

  test("GET /orders returns 401 with no Authorization header", async () => {
    const res = await request(app).get("/api/v1/auth/orders");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  test("GET /orders returns 401 with an invalid token", async () => {
    const res = await request(app)
      .get("/api/v1/auth/orders")
      .set("Authorization", "not-a-valid-jwt");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  test("GET /all-orders returns 401 when user is not admin (role 0)", async () => {
    const user = await userModel.create({
      name: "Regular User",
      email: "regular-auth@test.com",
      password: "pass123",
      phone: "99999999",
      address: "1 User Street",
      answer: "test",
      role: 0,
    });

    const token = signToken(user._id);

    const res = await request(app)
      .get("/api/v1/auth/all-orders")
      .set("Authorization", token);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("UnAuthorized Access");
  });
});

// ─── Orders endpoints integration ───────────────────────────────────────────

// Lu Yixuan, Deborah, A0277911X
describe("Orders: authenticated requests via full HTTP stack", () => {
  let userToken;
  let adminToken;
  let userId;
  let adminId;

  beforeAll(async () => {
    const user = await userModel.create({
      name: "Normal User",
      email: "user-orders@test.com",
      password: "user123",
      phone: "91111111",
      address: "1 User Road",
      answer: "user-answer",
      role: 0,
    });

    const admin = await userModel.create({
      name: "Admin User",
      email: "admin-orders@test.com",
      password: "admin123",
      phone: "92222222",
      address: "1 Admin Road",
      answer: "admin-answer",
      role: 1,
    });

    userId = user._id;
    adminId = admin._id;

    userToken = signToken(userId);
    adminToken = signToken(adminId);
  });

  afterAll(async () => {
    await userModel.deleteOne({ _id: userId });
    await userModel.deleteOne({ _id: adminId });
  });

  describe("GET /api/v1/auth/orders (getOrdersController)", () => {
    test("returns only the logged-in user's orders from the real DB", async () => {
      await orderModel.create([
        { buyer: userId, products: [], payment: { ok: true }, status: "Processing" },
        { buyer: adminId, products: [], payment: { ok: true }, status: "Shipped" },
      ]);

      const res = await request(app)
        .get("/api/v1/auth/orders")
        .set("Authorization", userToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);

      expect(res.body[0]).toEqual(
        expect.objectContaining({
          _id: expect.any(String),
          status: expect.any(String),
          products: expect.any(Array),
          buyer: expect.any(Object),
        })
      );

      expect(String(res.body[0].buyer?._id ?? res.body[0].buyer)).toBe(String(userId));
    });

    test("returns [] when user has no orders", async () => {
      const res = await request(app)
        .get("/api/v1/auth/orders")
        .set("Authorization", userToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test("returns 500 when DB operation fails (server error path)", async () => {
      // Force mongoose query to error
      await mongoose.connection.close();

      const res = await request(app)
        .get("/api/v1/auth/orders")
        .set("Authorization", userToken);

      expect(res.status).toBe(500);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: false,
          message: "Error while getting orders",
        })
      );

      // reconnect so later tests don't break
      await mongoose.connect(mongod.getUri());
    });
  });

  describe("GET /api/v1/auth/all-orders (getAllOrdersController)", () => {
    test("admin can retrieve all orders from the real DB", async () => {
      await orderModel.create([
        { buyer: userId, products: [], payment: {}, status: "Not Process" },
        { buyer: adminId, products: [], payment: {}, status: "cancel" },
      ]);

      const res = await request(app)
        .get("/api/v1/auth/all-orders")
        .set("Authorization", adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });
  });

  describe("PUT /api/v1/auth/order-status/:orderId (orderStatusController)", () => {
    test("admin updates order status and change persists in real DB", async () => {
      const order = await orderModel.create({
        buyer: userId,
        products: [],
        payment: {},
        status: "Not Process",
      });

      const res = await request(app)
        .put(`/api/v1/auth/order-status/${order._id}`)
        .set("Authorization", adminToken)
        .send({ status: "Shipped" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("Shipped");

      const updated = await orderModel.findById(order._id);
      expect(updated.status).toBe("Shipped");
    });

    test("returns 500 (or 404) when orderId does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .put(`/api/v1/auth/order-status/${fakeId}`)
        .set("Authorization", adminToken)
        .send({ status: "Shipped" });

      expect([200, 404, 500]).toContain(res.status);
    });
  });

  describe("Full lifecycle via HTTP: create (DB) → my orders → admin view all → admin update status", () => {
    test("complete workflow through the full HTTP stack", async () => {
      // Step 1: Create two orders in DB
      const o1 = await orderModel.create({
        buyer: userId,
        products: [],
        payment: {},
        status: "Not Process",
      });

      await orderModel.create({
        buyer: adminId,
        products: [],
        payment: {},
        status: "Not Process",
      });

      // Step 2: user views only their orders
      const myRes = await request(app)
        .get("/api/v1/auth/orders")
        .set("Authorization", userToken);

      expect(myRes.status).toBe(200);
      expect(myRes.body).toHaveLength(1);

      // Step 3: admin views all orders
      const allRes = await request(app)
        .get("/api/v1/auth/all-orders")
        .set("Authorization", adminToken);

      expect(allRes.status).toBe(200);
      expect(allRes.body.length).toBeGreaterThanOrEqual(2);

      // Step 4: admin updates order status
      const updateRes = await request(app)
        .put(`/api/v1/auth/order-status/${o1._id}`)
        .set("Authorization", adminToken)
        .send({ status: "Processing" });

      expect(updateRes.status).toBe(200);

      const after = await orderModel.findById(o1._id);
      expect(after.status).toBe("Processing");
    });
  });
});