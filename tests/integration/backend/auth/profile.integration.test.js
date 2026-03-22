//
// Lu Yixuan, Deborah, A0277911X
//
// Profile integration tests for MS2.
// Uses supertest + MongoMemoryServer to hit the real profile endpoint and verify that
// routing, auth middleware (requireSignIn), controller logic (updateProfileController),
// and the Mongoose userModel work together end-to-end:
//
//   route → requireSignIn → updateProfileController → userModel (real MongoDB)
//
// Covers: valid update persists, invalid fields rejected, unauthorised rejected,
// and response payload matches what Profile UI uses (name/phone/address).
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

// ─── Auth middleware integration ───────────────────────────────────────────

// Lu Yixuan, Deborah, A0277911X
describe("Auth middleware: protected profile route", () => {
  test("PUT /profile returns 401 with no Authorization header", async () => {
    const res = await request(app).put("/api/v1/auth/profile").send({ name: "X" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  test("PUT /profile returns 401 with an invalid token", async () => {
    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", "not-a-valid-jwt")
      .send({ name: "X" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });
});

// ─── updateProfileController integration ───────────────────────────────────

// Lu Yixuan, Deborah, A0277911X
describe("Profile update: full HTTP stack (requireSignIn → updateProfileController → userModel)", () => {
  test("valid update persists and returns userResponse payload used by Profile UI", async () => {
    // Seed real DB user
    const user = await userModel.create({
      name: "Old Name",
      email: "old@example.com",
      password: "oldpassword123",
      phone: "90000000",
      address: "Old Addr",
      answer: "x",
      role: 0,
    });

    const token = signToken(user._id);

    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", token)
      .send({
        name: "New Name",
        email: "should-not-change@example.com", // controller ignores email
        password: "newpass123",
        phone: "98887777",
        address: "New Addr",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Profile updated successfully",
        userResponse: expect.objectContaining({
          _id: expect.any(String),
          name: "New Name",
          phone: "98887777",
          address: "New Addr",
        }),
      })
    );

    // Verify persistence in DB (re-fetch)
    const updated = await userModel.findById(user._id);
    expect(updated).not.toBeNull();
    expect(updated.name).toBe("New Name");
    expect(updated.phone).toBe("98887777");
    expect(updated.address).toBe("New Addr");

    // Email should NOT change (controller doesn't update it)
    expect(updated.email).toBe("old@example.com");

    // Password should be updated + hashed (should not equal old plaintext)
    expect(updated.password).not.toBe("oldpassword123");
    expect(updated.password).not.toBe("newpass123");
  });

  test("rejects invalid password (<6 chars) with 400 and does not persist changes", async () => {
    const user = await userModel.create({
      name: "Old Name",
      email: "old@example.com",
      password: "oldpassword123",
      phone: "90000000",
      address: "Old Addr",
      answer: "x",
      role: 0,
    });

    const token = signToken(user._id);

    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", token)
      .send({
        name: "Should Not Apply",
        password: "123", // invalid
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Password must be at least 6 characters long",
      })
    );

    // Verify DB unchanged
    const after = await userModel.findById(user._id);
    expect(after.name).toBe("Old Name");
    expect(after.password).toBe("oldpassword123"); // unchanged because update aborted early
  });

  test("returns 404 when token is valid but user does not exist", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const token = signToken(fakeId);

    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", token)
      .send({ name: "X" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "User not found",
      })
    );
  });

  test("updates only provided fields and keeps others unchanged (edge case)", async () => {
    const user = await userModel.create({
      name: "Same Name",
      email: "same@example.com",
      password: "oldpassword123",
      phone: "90000000",
      address: "Same Addr",
      answer: "x",
      role: 0,
    });

    const token = signToken(user._id);

    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", token)
      .send({
        phone: "81112222", // only update phone
      });

    expect(res.status).toBe(200);
    expect(res.body.userResponse.phone).toBe("81112222");
    expect(res.body.userResponse.name).toBe("Same Name");
    expect(res.body.userResponse.address).toBe("Same Addr");

    const after = await userModel.findById(user._id);
    expect(after.phone).toBe("81112222");
    expect(after.name).toBe("Same Name");
    expect(after.address).toBe("Same Addr");
  });
});
