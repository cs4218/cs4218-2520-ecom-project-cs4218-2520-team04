//
// Mervyn Teo Zi Yan, A0273039A
//
// Integration tests for the User Registration flow.
// Tests the full HTTP and application stack using supertest:
//   Express Route → Validation Logic → Hashing Helper (bcrypt) → MongoDB (real DB)
//
// This verifies:
//   - Controller properly validates all required input fields before processing.
//   - The `hashPassword` helper is successfully integrated and encrypts passwords via bcrypt.
//   - Existing users are detected and prevented from creating duplicate accounts.
//   - Successful registrations correctly persist to the database and return sanitized user data.
//   - System correctly catches and responds to internal server errors.

import mongoose from "mongoose";
import request from "supertest";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";

import userModel from "../../../../models/userModel.js";
import { registerController } from "../../../../controllers/authController.js";
import { hashPassword, comparePassword } from "../../../../helpers/authHelper.js";
import bcrypt from "bcrypt";

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

    // Setup Express App and wire up the route
    const authRoutes = express.Router();
    authRoutes.post("/register", registerController);

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

// ─── Registration Flow Integration ──────────────────────────────────────────

describe("POST /api/v1/auth/register — User Registration Integration", () => {
    const validUser = {
        name: "John Doe",
        email: "john@example.com",
        password: "securepassword",
        phone: "12345678",
        address: "123 Main St",
        answer: "blue",
    };

    test("Successfully creates a new user, hashes the password via bcrypt, and persists to DB", async () => {
        const res = await request(app).post("/api/v1/auth/register").send(validUser);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("User registered successfully");

        expect(res.body.user.password).toBeUndefined();
        expect(res.body.user.answer).toBeUndefined();
        expect(res.body.user.email).toBe(validUser.email);

        const savedUser = await userModel.findOne({ email: validUser.email });
        expect(savedUser).not.toBeNull();

        expect(savedUser.password).not.toBe(validUser.password); // Should not be plaintext
        const isPasswordValid = await comparePassword(validUser.password, savedUser.password);
        expect(isPasswordValid).toBe(true); // Should successfully compare via bcrypt
    });

    test("Returns 200 (false success) when attempting to register an existing email", async () => {
        const hashed = await hashPassword(validUser.password);
        await userModel.create({ ...validUser, password: hashed });

        const res = await request(app).post("/api/v1/auth/register").send(validUser);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Already registered, please log in");

        expect(await userModel.countDocuments({ email: validUser.email })).toBe(1);
    });

    // Parameterized test to efficiently check ALL required fields validation
    describe("Input Validation Edge Cases", () => {
        const requiredFields = [
            { field: "name", message: "Name is required" },
            { field: "email", message: "Email is required" },
            { field: "password", message: "Password is required" },
            { field: "phone", message: "Phone number is required" },
            { field: "address", message: "Address is required" },
            { field: "answer", message: "Answer is required" }
        ];

        test.each(requiredFields)("Returns 400 when '$field' is missing", async ({ field, message }) => {
            const incompleteUser = { ...validUser };
            delete incompleteUser[field];

            const res = await request(app)
                .post("/api/v1/auth/register")
                .send(incompleteUser);

            expect(res.status).toBe(400);
            expect(res.body.message).toBe(message);
        });
    });

    test("Returns 500 when an internal server error occurs", async () => {
        jest.spyOn(userModel, "findOne").mockImplementationOnce(() => {
            throw new Error("Simulated Database Error");
        });

        const res = await request(app).post("/api/v1/auth/register").send(validUser);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Error in registration");
    });
});
