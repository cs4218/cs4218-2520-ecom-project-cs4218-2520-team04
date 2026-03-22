//
// Mervyn Teo Zi Yan, A0273039A
//
// Integration tests for the User Login flow.
// Tests the full HTTP and application stack using supertest:
//   Express Route → Controller Validation → DB Lookup (MongoDB) → bcrypt Compare → JWT Generation
//
// This verifies:
//   - Controller correctly validates missing inputs.
//   - Existing users are successfully retrieved from the database.
//   - The `comparePassword` helper accurately validates plaintext against hashed DB passwords.
//   - Upon success, a valid, decodable JWT containing the user's ID is generated and returned.
//   - Sensitive user information (password, answer) is stripped from the login response.
//   - System correctly catches and responds to internal server errors.

import mongoose from "mongoose";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";

import userModel from "../../../../models/userModel.js";
import { loginController } from "../../../../controllers/authController.js";
import { hashPassword } from "../../../../helpers/authHelper.js";

process.env.JWT_SECRET = "test-jwt-secret-integration";

// Silence console noise during tests
beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
});

beforeEach(() => jest.spyOn(console, "log").mockImplementation(() => {}));

let mongod;
let app;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    const authRoutes = express.Router();
    authRoutes.post("/login", loginController);

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

// ─── Login Flow Integration ───────────────────────────────────────────────

describe("POST /api/v1/auth/login — User Authentication Integration", () => {
    let testUserId;
    const loginUser = {
        email: "login@example.com",
        password: "mypassword123"
    };

    beforeEach(async () => {
        // Seed the database
        const hashed = await hashPassword(loginUser.password);
        const user = await userModel.create({
            name: "Login Tester",
            email: loginUser.email,
            password: hashed,
            phone: "00000000",
            address: "Login Ave",
            answer: "red",
            role: 1,
        });
        testUserId = user._id.toString();
    });

    test("Successfully authenticates user, returns sanitized data, and generates a valid JWT", async () => {
        const res = await request(app).post("/api/v1/auth/login").send(loginUser);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Login successful");

        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe(loginUser.email);
        expect(res.body.user.role).toBe(1);
        expect(res.body.user.password).toBeUndefined(); // Security check
        expect(res.body.user.answer).toBeUndefined();   // Security check

        expect(res.body.token).toBeDefined();

        const decodedToken = jwt.verify(res.body.token, process.env.JWT_SECRET);
        expect(decodedToken._id).toBe(testUserId);
    });

    test("Returns 200 (false success) when the password does not match (bcrypt compare fails)", async () => {
        const res = await request(app).post("/api/v1/auth/login").send({
            email: loginUser.email,
            password: "wrongpassword",
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Invalid password");
        expect(res.body.token).toBeUndefined();
    });

    test("Returns 404 when attempting to login with an unregistered email", async () => {
        const res = await request(app).post("/api/v1/auth/login").send({
            email: "nobody@example.com",
            password: "password123",
        });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Email is not registered");
    });

    describe("Input Validation Edge Cases", () => {
        const invalidInputs = [
            { payload: { email: "login@example.com" }, missing: "password" },
            { payload: { password: "mypassword123" }, missing: "email" },
            { payload: {}, missing: "both" }
        ];

        test.each(invalidInputs)("Returns 404 when $missing is missing from the request", async ({ payload }) => {
            const res = await request(app)
                .post("/api/v1/auth/login")
                .send(payload);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe("Invalid email or password");
        });
    });

    test("Returns 500 when an internal server error occurs during login", async () => {
        jest.spyOn(userModel, "findOne").mockImplementationOnce(() => {
            throw new Error("Simulated Database Error");
        });

        const res = await request(app).post("/api/v1/auth/login").send(loginUser);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Error in login");
    });
});
