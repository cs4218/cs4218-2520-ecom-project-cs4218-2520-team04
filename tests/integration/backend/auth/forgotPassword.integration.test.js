//
// Mervyn Teo Zi Yan, A0273039A
//
// Integration tests for the Password Recovery (Forgot Password) flow.
// Tests the full HTTP and application stack using supertest:
//   Express Route → Input Validation → MongoDB Lookup → bcrypt Hashing → MongoDB Update
//
// This verifies:
//   - Controller properly validates all required input fields.
//   - System correctly identifies users by the combination of email AND secret answer.
//   - The `hashPassword` helper successfully encrypts the new password before saving.
//   - Failed attempts (wrong answer/email) leave the original user record unmodified.
//   - System correctly catches and responds to internal server errors.

import mongoose from "mongoose";
import request from "supertest";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";

import userModel from "../../../../models/userModel.js";
import { forgotPasswordController } from "../../../../controllers/authController.js";
import { hashPassword, comparePassword } from "../../../../helpers/authHelper.js";

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
    authRoutes.post("/forgot-password", forgotPasswordController);

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

// ─── Forgot Password Integration ──────────────────────────────────────────

describe("POST /api/v1/auth/forgot-password — Account Recovery Integration", () => {
    const recoveryUser = {
        email: "recover@test.com",
        answer: "my secret dog",
        password: "oldpassword"
    };

    beforeEach(async () => {
        const hashedOldPassword = await hashPassword(recoveryUser.password);
        await userModel.create({
            name: "Recovery Tester",
            email: recoveryUser.email,
            password: hashedOldPassword,
            phone: "11111111",
            address: "Recovery St",
            answer: recoveryUser.answer,
            role: 0,
        });
    });

    test("Successfully authenticates secret answer, hashes new password, and updates DB", async () => {
        const newPassword = "brandnewpassword";

        const res = await request(app).post("/api/v1/auth/forgot-password").send({
            email: recoveryUser.email,
            answer: recoveryUser.answer,
            newPassword: newPassword,
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Password reset successfully");

        const updatedUser = await userModel.findOne({ email: recoveryUser.email });

        expect(updatedUser.password).not.toBe(newPassword);

        const isNewPasswordValid = await comparePassword(newPassword, updatedUser.password);
        expect(isNewPasswordValid).toBe(true);
    });

    test("Returns 404 and does NOT alter the DB when the secret answer is incorrect", async () => {
        const res = await request(app).post("/api/v1/auth/forgot-password").send({
            email: recoveryUser.email,
            answer: "wrong secret answer",
            newPassword: "brandnewpassword",
        });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Wrong email or answer");

        // Ensure the old password was not overwritten
        const unchangedUser = await userModel.findOne({ email: recoveryUser.email });
        const isOldPasswordStillValid = await comparePassword(recoveryUser.password, unchangedUser.password);
        expect(isOldPasswordStillValid).toBe(true);
    });

    test("Returns 404 when attempting to recover an unregistered email", async () => {
        const res = await request(app).post("/api/v1/auth/forgot-password").send({
            email: "nobody@test.com",
            answer: recoveryUser.answer,
            newPassword: "brandnewpassword",
        });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    describe("Input Validation Edge Cases", () => {
        const invalidInputs = [
            { payload: { answer: "dog", newPassword: "pass" }, message: "Email is required" },
            { payload: { email: "a@a.com", newPassword: "pass" }, message: "Answer is required" },
            { payload: { email: "a@a.com", answer: "dog" }, message: "New password is required" }
        ];

        test.each(invalidInputs)("Returns 400 when a required field is missing ($message)", async ({ payload, message }) => {
            const res = await request(app)
                .post("/api/v1/auth/forgot-password")
                .send(payload);

            expect(res.status).toBe(400);
            expect(res.body.message).toBe(message);
        });
    });

    test("Returns 500 when an internal server error occurs during lookup", async () => {
        jest.spyOn(userModel, "findOne").mockImplementationOnce(() => {
            throw new Error("Simulated Database Error");
        });

        const res = await request(app).post("/api/v1/auth/forgot-password").send({
            email: recoveryUser.email,
            answer: recoveryUser.answer,
            newPassword: "brandnewpassword",
        });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Something went wrong");
    });

    describe("Security Edge Cases — Forgot Password", () => {
        test("NoSQL Injection via '$ne' operator shouldn't be possible", async () => {
            const originalPassword = "safepassword";
            const hashedOldPassword = await hashPassword(originalPassword);

            const user = await userModel.create({
                name: "Security Tester",
                email: "nosql@test.com",
                password: hashedOldPassword,
                phone: "11111111",
                address: "Security St",
                answer: "my real secret answer",
                role: 0,
            });

            const res = await request(app).post("/api/v1/auth/forgot-password").send({
                email: "nosql@test.com",
                answer: { $ne: "I dont know the answer" }, // Malicious Payload
                newPassword: "hackedpassword",
            });

            expect(res.status).not.toBe(200);

            const unchangedUser = await userModel.findById(user._id);
            const isCompromised = await comparePassword("hackedpassword", unchangedUser.password);

            expect(isCompromised).toBe(false);
        });
    });
});
