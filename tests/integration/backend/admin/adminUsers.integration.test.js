//
// Lu Yixuan, Deborah, A0277911X
//
// Admin Users Listing integration tests for MS2.
// Uses supertest + MongoMemoryServer to verify the full backend stack works together:
//
//   route → requireSignIn → isAdmin → getAllUsersController → userModel (real MongoDB)
//
// Covers: admin success, normal user forbidden, unauthorised, and response schema for UI tables.
//
// Note: This test file was generated with assistance from ChatGPT and then reviewed/edited by me.
//

import mongoose from "mongoose";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";

import authRoutes from "../../../../routes/authRoute.js";
import userModel from "../../../../models/userModel.js";

process.env.JWT_SECRET = "test-jwt-secret-integration";

// suppress console.log from middleware/controller
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
  await userModel.deleteMany({});
});

function signToken(userId) {
  return jwt.sign({ _id: userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

describe("Admin users listing endpoint (GET /api/v1/auth/users)", () => {
  test("returns 401 when no token is provided", async () => {
    const res = await request(app).get("/api/v1/auth/users");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  test("returns 401 when token is invalid", async () => {
    const res = await request(app)
      .get("/api/v1/auth/users")
      .set("Authorization", "not-a-valid-jwt");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  test("returns 401 when user is not admin (role 0)", async () => {
    const normalUser = await userModel.create({
      name: "Normal",
      email: "normal@test.com",
      password: "pass123",
      phone: "90000000",
      address: "Somewhere",
      answer: "x",
      role: 0,
    });

    const token = signToken(normalUser._id);

    const res = await request(app)
      .get("/api/v1/auth/users")
      .set("Authorization", token);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("UnAuthorized Access");
  });

  test("admin success: returns users list with fields needed for table rendering", async () => {
    // Create admin
    const admin = await userModel.create({
      name: "Admin",
      email: "admin@test.com",
      password: "admin123",
      phone: "98887777",
      address: "Adminland",
      answer: "admin",
      role: 1,
    });
    const adminToken = signToken(admin._id);

    // Create some users
    await userModel.create([
      {
        name: "U1",
        email: "u1@test.com",
        password: "pass123",
        phone: "91111111",
        address: "A",
        answer: "x",
        role: 0,
      },
      {
        name: "U2",
        email: "u2@test.com",
        password: "pass123",
        phone: "92222222",
        address: "B",
        answer: "x",
        role: 0,
      },
    ]);

    const res = await request(app)
      .get("/api/v1/auth/users")
      .set("Authorization", adminToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThanOrEqual(3);

    // Schema: safe minimum for UI table
    expect(res.body.users[0]).toEqual(
      expect.objectContaining({
        _id: expect.any(String),
        name: expect.any(String),
        email: expect.any(String),
        role: expect.any(Number),
      })
    );

    // Security: ensure password isn't leaked
    expect(res.body.users[0].password).toBeUndefined();
  });

  test("handles empty user list gracefully (returns success true + users array)", async () => {
    // Create ONLY admin, then list
    const admin = await userModel.create({
      name: "AdminOnly",
      email: "adminonly@test.com",
      password: "admin123",
      phone: "90000000",
      address: "Adminland",
      answer: "admin",
      role: 1,
    });
    const adminToken = signToken(admin._id);

    const res = await request(app)
      .get("/api/v1/auth/users")
      .set("Authorization", adminToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});
