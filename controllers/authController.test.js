import {
    registerController,
    loginController,
    forgotPasswordController,
    testController,
    updateProfileController,
    getOrdersController,
    getAllOrdersController,
    orderStatusController
} from "./authController";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import { hashPassword, comparePassword } from "../helpers/authHelper.js";
import JWT from "jsonwebtoken";

// Mock the dependencies
jest.mock("../models/userModel.js");
jest.mock("../models/orderModel.js");
jest.mock("../helpers/authHelper.js");
jest.mock("jsonwebtoken");

describe("Auth Controller Unit Tests", () => {
    let req, res;
    let testReq;

    beforeEach(() => {
        req = { body: {}, params: {}, user: {} };
        testReq = {
            name: "John Doe",
            email: "john@example.com",
            password: "password123",
            phone: "123456789",
            address: "123 Street",
            answer: "blue",
        };
        res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => {});
    });



    // --- REGISTER CONTROLLER TESTS ---
    describe("registerController", () => {
        it("should return error if name is missing", async () => {
            req.body = testReq;
            delete req.body.name;
            await registerController(req, res);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ error: "Name is Required" }));
        });

        it("should return error if email is missing", async () => {
            req.body = testReq;
            delete req.body.email;
            await registerController(req, res);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Email is Required" }));
        });

        it("should return error if password is missing", async () => {
            req.body = testReq;
            delete req.body.password;
            await registerController(req, res);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Password is Required" }));
        });

        it("should return error if phone is missing", async () => {
            req.body = testReq;
            delete req.body.phone;
            await registerController(req, res);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Phone no is Required" }));
        });

        it("should return error if address is missing", async () => {
            req.body = testReq;
            delete req.body.address;
            await registerController(req, res);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Address is Required" }));
        });

        it("should return error if answer is missing", async () => {
            req.body = testReq;
            delete req.body.answer;
            await registerController(req, res);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Answer is Required" }));
        });


        it("should register a user successfully", async () => {
            req.body =  testReq;

            userModel.findOne.mockResolvedValue(null);
            hashPassword.mockResolvedValue("hashed_pwd");

            // Mock the save method of the model instance
            const saveMock = jest.fn().mockResolvedValue(req.body);
            userModel.prototype.save = saveMock;

            await registerController(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: "User Register Successfully",
            }));
        });

        it("should fail if user already exists", async () => {
            req.body = { email: "existing@test.com", name: "test", password: "123", phone: "1", address: "a", answer: "b" };
            userModel.findOne.mockResolvedValue({ email: "existing@test.com" });

            await registerController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: "Already Register please login",
            }));
        });

        it("should return 500 on server error", async () => {
            req.body = testReq;
            userModel.findOne.mockRejectedValue(new Error("DB Error"));

            await registerController(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Errro in Registeration",
            }));
        })

        it("should return 404 if email or password is missing", async () => {
            req.body = { email: "", password: "" };
            await loginController(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Invalid email or password",
            }));
        })
    });

    // --- LOGIN CONTROLLER TESTS ---
    describe("loginController", () => {
        it("should login successfully and return a token", async () => {
            req.body = { email: "john@example.com", password: "password123" };
            const mockUser = {
                _id: "123",
                name: "John",
                email: "john@example.com",
                password: "hashed_password",
                role: 0
            };

            userModel.findOne.mockResolvedValue(mockUser);
            comparePassword.mockResolvedValue(true);
            JWT.sign.mockReturnValue("mock_token");

            await loginController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                token: "mock_token",
            }));
        });

        it("should return 404 if email is not registered", async () => {
            req.body = { email: "wrong@test.com", password: "123" };
            userModel.findOne.mockResolvedValue(null);

            await loginController(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Email is not registerd",
            }));
        });

        it("should return 200 if password is invalid", async () => {
            req.body = { email: "wrong@test.com", password: "123" };
            const mockUser = {
                _id: "123",
                name: "John",
                email: "wrong@test.com",
                password: "hashed_password",
                role: 0
            };
            userModel.findOne.mockResolvedValue(mockUser);
            comparePassword.mockResolvedValue(false);

            await loginController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Invalid Password",
            }));
        });

        it("should return 500 on server error", async () => {
            req.body = { email: "wrong@test.com", password: "123" };
            userModel.findOne.mockRejectedValue(new Error("DB Error"));

            await loginController(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Error in login",
            }));
        })
    });

    // --- FORGOT PASSWORD TESTS ---
    describe("forgotPasswordController", () => {
        it("should reset password successfully", async () => {
            req.body = { email: "test@test.com", answer: "blue", newPassword: "new123" };
            userModel.findOne.mockResolvedValue({ _id: "user123" });
            hashPassword.mockResolvedValue("new_hash");

            await forgotPasswordController(req, res);

            expect(userModel.findByIdAndUpdate).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Password Reset Successfully",
            }));
        });

        it("should return 404 for wrong email or answer", async () => {
            req.body = { email: "test@test.com", answer: "blue", newPassword: "new123" };
        userModel.findOne.mockResolvedValue(null);
            await forgotPasswordController(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Wrong Email Or Answer",
            }));
        });

        it("should return 400 if email is missing", async () => {
            req.body = { answer: "blue", newPassword: "new123" };
            await forgotPasswordController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Emai is required",
            }));
        });

        it("should return 400 if answer is missing", async () => {
            req.body = { email: "test@test.com", newPassword: "new123" };
            await forgotPasswordController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "answer is required",
            }));
        });

        it("should return 400 if newPassword is missing", async () => {
            req.body = { email: "test@test.com", answer: "blue" };
            await forgotPasswordController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "New Password is required",
            }));
        });

        it("should return 500 on server error", async () => {
            req.body = { email: "test@test.com", answer: "blue", newPassword: "new123" };
            userModel.findOne.mockRejectedValue(new Error("DB Error"));

            await forgotPasswordController(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Something went wrong",
            }));
        });
    });

    describe("testController", () => {
        it("should respond with 'Protected Routes'", async () => {
            await testController(req, res);
            expect(res.send).toHaveBeenCalledWith("Protected Routes");
        });

        it("should handle errors gracefully", async () => {
            const error = new Error("Test Error");

            res.send.mockImplementationOnce(() => {
                throw error;
            });

            await testController(req, res);

            expect(console.log).toHaveBeenCalledWith(error);
            expect(res.send).toHaveBeenCalledWith({ error });
        });
    });
});