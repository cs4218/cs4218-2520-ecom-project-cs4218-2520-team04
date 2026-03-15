//
// Tan Wei Lian, A0269750U
//
// Integration tests for userModel + authController via full HTTP stack.
// Tests go through: route → controller → hashPassword/comparePassword helpers → userModel → real MongoDB
// This verifies:
//   - userModel schema required-field validation is enforced end-to-end
//   - hashPassword helper is called on register and the stored password is NOT plaintext
//   - comparePassword helper is exercised on login (correct and wrong credentials)
//   - Duplicate email detection via userModel.findOne
//   - JWT is returned on successful login and is valid
//   - role defaults to 0 (regular user) for new registrations

import mongoose from "mongoose";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { MongoMemoryServer } from "mongodb-memory-server";
import authRoute from "../../routes/authRoute.js";
import userModel from "../../models/userModel.js";

process.env.JWT_SECRET = "test-jwt-secret-usermodel";

beforeEach(() => jest.spyOn(console, "log").mockImplementation(() => {}));

jest.mock("braintree", () => ({
  BraintreeGateway: jest.fn().mockImplementation(() => ({})),
  Environment: { Sandbox: "sandbox" },
}));

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoute);
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

// ─── Registration — userModel schema + hashPassword helper ──────────────────

describe("POST /api/v1/auth/register — userModel schema validation + password hashing", () => {
  const validUser = {
    name: "Alice",
    email: "alice@test.com",
    password: "secret123",
    phone: "91234567",
    address: "1 Test St",
    answer: "blue",
  };

  test("registers a new user and stores a bcrypt-hashed password (not plaintext)", async () => {
    // Integration: register → hashPassword helper → userModel.save → DB
    // Verifies that the plaintext password never reaches the DB
    const res = await request(app).post("/api/v1/auth/register").send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Confirm the password stored in DB is hashed, not plaintext
    const saved = await userModel.findOne({ email: validUser.email });
    expect(saved).not.toBeNull();
    expect(saved.password).not.toBe(validUser.password);
    const isHashed = await bcrypt.compare(validUser.password, saved.password);
    expect(isHashed).toBe(true);
  });

  test("new user defaults to role 0 (regular user)", async () => {
    // Integration: userModel schema default for role field is 0
    await request(app).post("/api/v1/auth/register").send(validUser);
    const saved = await userModel.findOne({ email: validUser.email });
    expect(saved.role).toBe(0);
  });

  test("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validUser, name: "" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Name is required");
  });

  test("returns 400 when password is missing", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validUser, password: "" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Password is required");
  });

  test("returns success:false when email is already registered (duplicate detection via userModel)", async () => {
    // Integration: first register succeeds; second with same email hits userModel.findOne → duplicate branch
    await request(app).post("/api/v1/auth/register").send(validUser);
    const res = await request(app).post("/api/v1/auth/register").send(validUser);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Already registered, please log in");

    // Only one user record in DB
    expect(await userModel.countDocuments({ email: validUser.email })).toBe(1);
  });
});

// ─── Login — comparePassword helper + JWT signing ───────────────────────────

describe("POST /api/v1/auth/login — comparePassword helper + JWT generation", () => {
  test("returns a valid JWT and user object on correct credentials", async () => {
    // Integration: login → userModel.findOne → comparePassword → JWT.sign
    // Registers first, then logs in to confirm the full round-trip
    const password = "mypassword";
    const hashedPw = await bcrypt.hash(password, 10);
    await userModel.create({
      name: "Bob",
      email: "bob@test.com",
      password: hashedPw,
      phone: "81234567",
      address: "2 Bob St",
      answer: "red",
      role: 0,
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "bob@test.com", password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();

    // JWT should decode to the user's _id
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    const user = await userModel.findOne({ email: "bob@test.com" });
    expect(decoded._id).toBe(user._id.toString());
  });

  test("returns success:false on wrong password (comparePassword returns false)", async () => {
    const hashedPw = await bcrypt.hash("correctpassword", 10);
    await userModel.create({
      name: "Carol",
      email: "carol@test.com",
      password: hashedPw,
      phone: "81111111",
      address: "3 Carol St",
      answer: "green",
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "carol@test.com", password: "wrongpassword" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid password");
  });

  test("returns 404 when email is not registered", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@test.com", password: "pass" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Email is not registered");
  });

  test("login response includes role field from userModel", async () => {
    // Integration: role stored in userModel is returned in the login response
    const hashedPw = await bcrypt.hash("adminpass", 10);
    await userModel.create({
      name: "Dave Admin",
      email: "dave@test.com",
      password: hashedPw,
      phone: "82222222",
      address: "4 Dave St",
      answer: "purple",
      role: 1,
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "dave@test.com", password: "adminpass" });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe(1);
  });
});
