// Mervyn Teo Zi Yan, A0273039A
import { requireSignIn, isAdmin } from "./authMiddleware";
import JWT from "jsonwebtoken";
import userModel from "../models/userModel.js";

jest.mock("jsonwebtoken");
jest.mock("../models/userModel.js");

// Written with the aid of Gemini AI
describe("Auth Middleware Tests", () => {
    let req, res, next;

    beforeEach(() => {
        req = { headers: { authorization: "mock-token" } };
        res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };
        next = jest.fn();
        jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // --- REQUIRE SIGN IN TESTS ---
    describe("requireSignIn", () => {
        it("should call next() on valid token", async () => {
            JWT.verify.mockReturnValue({ _id: "1" });
            await requireSignIn(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it("should log error on invalid token", async () => {
            JWT.verify.mockImplementation(() => { throw new Error("JWT Error"); });
            await requireSignIn(req, res, next);
            // Verify it logged the error without showing it in the terminal
            expect(console.log).toHaveBeenCalled();
            expect(next).not.toHaveBeenCalled();
            // Verify it sent the correct response
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Invalid or expired token"
            }));
        });
    });

    // --- IS ADMIN TESTS ---
    describe("isAdmin", () => {
        it("should authorize admin users (role 1)", async () => {
            // Updated: We manually set req.user because isAdmin assumes requireSignIn ran first
            req.user = { _id: "admin_id" };

            // We do NOT mock JWT.verify here anymore, because your new isAdmin code doesn't use it.
            userModel.findById.mockResolvedValue({ role: 1 });

            await isAdmin(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it("should reject non-admin users", async () => {
            req.user = { _id: "user_id" };
            userModel.findById.mockResolvedValue({ role: 0 });

            await isAdmin(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "UnAuthorized Access"
            }));
        });

        it("should handle errors gracefully", async () => {
            req.user = { _id: "id" };
            // Simulate DB error
            userModel.findById.mockRejectedValue(new Error("Test Error"));

            await isAdmin(req, res, next);

            expect(console.log).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Error in admin middleware"
            }));
        });
    });
});