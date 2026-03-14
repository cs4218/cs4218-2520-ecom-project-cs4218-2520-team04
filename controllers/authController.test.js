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

describe("Auth Controller Unit Tests", () => { // Mervyn Teo Zi Yan, A0273039A
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
    // Written with the aid of Gemini AI
    describe("registerController", () => { // Mervyn Teo Zi Yan, A0273039A
        it("should return error if name is missing", async () => {
            req.body = testReq;
            delete req.body.name;
            await registerController(req, res);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Name is required" }));
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should return error if email is missing", async () => {
            req.body = testReq;
            delete req.body.email;
            await registerController(req, res);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Email is required" }));
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should return error if password is missing", async () => {
            req.body = testReq;
            delete req.body.password;
            await registerController(req, res);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Password is required" }));
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should return error if phone is missing", async () => {
            req.body = testReq;
            delete req.body.phone;
            await registerController(req, res);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Phone number is required" }));
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should return error if address is missing", async () => {
            req.body = testReq;
            delete req.body.address;
            await registerController(req, res);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Address is required" }));
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should return error if answer is missing", async () => {
            req.body = testReq;
            delete req.body.answer;
            await registerController(req, res);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: "Answer is required" }));
            expect(res.status).toHaveBeenCalledWith(400);

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
                message: "User registered successfully",
            }));
        });

        it("should fail if user already exists", async () => {
            req.body = { email: "existing@test.com", name: "test", password: "123", phone: "1", address: "a", answer: "b" };
            userModel.findOne.mockResolvedValue({ email: "existing@test.com" });

            await registerController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: "Already registered, please log in",
            }));
        });

        it("should return 500 on server error", async () => {
            req.body = testReq;
            userModel.findOne.mockRejectedValue(new Error("DB Error"));

            await registerController(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Error in registration",
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

        it("should not return the password hash when a user registers", async () => {
            req.body = testReq;
            userModel.findOne.mockResolvedValue(null);
            hashPassword.mockResolvedValue("hashed_pwd");

            // Mock save to return a simulated DB document
            const mockDbUser = { ...req.body, _id: "123", password: "hashed_pwd" };
            userModel.prototype.save = jest.fn().mockResolvedValue(mockDbUser);

            await registerController(req, res);

            expect(res.status).toHaveBeenCalledWith(201);

            // Check the arguments passed to res.send
            const responsePayload = res.send.mock.calls[0][0];

            // This will fail on the old code because responsePayload.user.password exists
            expect(responsePayload.user).not.toHaveProperty("password");
            expect(responsePayload.user.email).toBe("john@example.com");
        });
    });

    // --- LOGIN CONTROLLER TESTS ---
    // Written with the aid of Gemini AI
    describe("loginController", () => { // Mervyn Teo Zi Yan, A0273039A
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
                message: "Email is not registered",
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
                message: "Invalid password",
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
    // Written with the aid of Gemini AI
    describe("forgotPasswordController", () => { // Mervyn Teo Zi Yan, A0273039A
        it("should reset password successfully", async () => {
            req.body = { email: "test@test.com", answer: "blue", newPassword: "new123" };
            userModel.findOne.mockResolvedValue({ _id: "user123" });
            hashPassword.mockResolvedValue("new_hash");

            await forgotPasswordController(req, res);

            expect(userModel.findByIdAndUpdate).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Password reset successfully",
            }));
        });

        it("should return 404 for wrong email or answer", async () => {
            req.body = { email: "test@test.com", answer: "blue", newPassword: "new123" };
        userModel.findOne.mockResolvedValue(null);
            await forgotPasswordController(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Wrong email or answer",
            }));
        });

        it("should return 400 if email is missing", async () => {
            req.body = { answer: "blue", newPassword: "new123" };
            await forgotPasswordController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Email is required",
            }));
        });

        it("should return 400 if answer is missing", async () => {
            req.body = { email: "test@test.com", newPassword: "new123" };
            await forgotPasswordController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "Answer is required",
            }));
        });

        it("should return 400 if newPassword is missing", async () => {
            req.body = { email: "test@test.com", answer: "blue" };
            await forgotPasswordController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
                message: "New password is required",
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
        it("should respond with 'Protected Routes'", async () => { // Mervyn Teo Zi Yan, A0273039A
            await testController(req, res);
            expect(res.send).toHaveBeenCalledWith("Protected Routes");
        });

        it("should handle errors gracefully", async () => { // Mervyn Teo Zi Yan, A0273039A
            const error = new Error("Test Error");

            res.send.mockImplementationOnce(() => {
                throw error;
            });

            await testController(req, res);

            expect(console.log).toHaveBeenCalledWith(error);
            expect(res.send).toHaveBeenCalledWith({ error });
        });
    });

    // --- UPDATE PROFILE TESTS ---
    describe("updateProfileController", () => {
        it("should not return the password hash when a user updates their profile without changing password", async () => {
            req.user = { _id: "user123" };
            req.body = { name: "New Name", password: "", phone: "111", address: "NewAddr" };

            const existingUser = {
                _id: "user123",
                name: "Old",
                password: "oldhash",
                phone: "999",
                address: "OldAddr",
            };

            userModel.findById.mockResolvedValue(existingUser);

            const updatedUser = {
                ...existingUser,
                name: "New Name",
                phone: "111",
                address: "NewAddr",
                // password stays oldhash
                password: "oldhash",
            };

            userModel.findByIdAndUpdate.mockResolvedValue(updatedUser);

            await updateProfileController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);

            const responsePayload = res.send.mock.calls[0][0];

            expect(responsePayload.userResponse).not.toHaveProperty("password");
        })

        it("should return 404 if user not found", async () => {
            req.user = { _id: "user123" };
            req.body = { name: "New", password: "", phone: "1", address: "A" };

            userModel.findById.mockResolvedValue(null);

            await updateProfileController(req, res);

            expect(userModel.findById).toHaveBeenCalledWith("user123");
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: "User not found",
                })
            );
        });

        it("should return 400 if password exists and is < 6 chars", async () => {
            req.user = { _id: "user123" };
            req.body = { name: "New", password: "123", phone: "1", address: "A" };

            userModel.findById.mockResolvedValue({
                _id: "user123",
                name: "Old",
                password: "oldhash",
                phone: "999",
                address: "OldAddr",
            });

            await updateProfileController(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: "Password must be at least 6 characters long",
                })
            );
            expect(hashPassword).not.toHaveBeenCalled();
            expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it("should update profile without hashing if password not provided", async () => {
            req.user = { _id: "user123" };
            req.body = { name: "New Name", password: "", phone: "111", address: "NewAddr" };

            const existingUser = {
                _id: "user123",
                name: "Old",
                password: "oldhash",
                phone: "999",
                address: "OldAddr",
            };

            userModel.findById.mockResolvedValue(existingUser);

            const updatedUser = {
                ...existingUser,
                name: "New Name",
                phone: "111",
                address: "NewAddr",
            };

            userModel.findByIdAndUpdate.mockResolvedValue(updatedUser);

            await updateProfileController(req, res);

            expect(hashPassword).not.toHaveBeenCalled();

            expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
                "user123",
                {
                    name: "New Name",
                    phone: "111",
                    password: "oldhash", // should fallback to old password
                    address: "NewAddr",
                },
                { new: true }
            );

            const userResponse = {
                _id: updatedUser._id,
                name: updatedUser.name,
                phone: updatedUser.phone,
                address: updatedUser.address,
            }

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: "Profile updated successfully",
                    userResponse,
                })
            );
        });

        it("should update profile and hash password when password provided (>= 6)", async () => {
            req.user = { _id: "user123" };
            req.body = {
                name: "New Name",
                password: "newpass123",
                phone: "111",
                address: "NewAddr",
            };

            const existingUser = {
                _id: "user123",
                name: "Old",
                password: "oldhash",
                phone: "999",
                address: "OldAddr",
            };

            userModel.findById.mockResolvedValue(existingUser);
            hashPassword.mockResolvedValue("newhash");

            const updatedUser = {
                ...existingUser,
                name: "New Name",
                phone: "111",
                address: "NewAddr",
            };

            userModel.findByIdAndUpdate.mockResolvedValue(updatedUser);

            await updateProfileController(req, res);

            expect(hashPassword).toHaveBeenCalledWith("newpass123");

            expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
                "user123",
                {
                    name: "New Name",
                    phone: "111",
                    address: "NewAddr",
                    password: "newhash",
                },
                { new: true }
            );

            const userResponse = {
                _id: updatedUser._id,
                name: updatedUser.name,
                phone: updatedUser.phone,
                address: updatedUser.address,
            }

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: "Profile updated successfully",
                    userResponse,
                })
            );
        });

        it("should handle unexpected errors and return 400", async () => {
            req.user = { _id: "user123" };
            req.body = { name: "New Name", password: "", phone: "111", address: "NewAddr" };

            userModel.findById.mockRejectedValue(new Error("DB Error"));

            await updateProfileController(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: "Error while updating profile",
                })
            );
        });

        it("should fallback to existing user fields when name/phone/address are missing", async () => {
            req.user = { _id: "user123" };
            // name/phone/address intentionally undefined (forces fallback)
            req.body = { password: "" };

            const existingUser = {
                _id: "user123",
                name: "OldName",
                password: "oldhash",
                phone: "999",
                address: "OldAddr",
            };

            userModel.findById.mockResolvedValue(existingUser);

            const updatedUser = { ...existingUser };
            userModel.findByIdAndUpdate.mockResolvedValue(updatedUser);

            await updateProfileController(req, res);

            expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
                "user123",
                {
                    name: "OldName",      // fallback
                    password: "oldhash",  // fallback
                    phone: "999",         // fallback
                    address: "OldAddr",   // fallback
                },
                { new: true }
            );

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: "Profile updated successfully",
                })
            );
        });

        it("when email missing: sends 400 (and does not reset password)", async () => {
            req.body = { email: "", answer: "blue", newPassword: "new123" };

            await forgotPasswordController(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({ message: "Email is required" })
            );

            expect(userModel.findOne).not.toHaveBeenCalled();
            expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
        });
    });

    // --- ORDER TESTS ---
    describe("Order Controllers", () => {
        describe("getOrdersController", () => {
            it("should return orders for the logged-in user", async () => {
                req.user = { _id: "user123" };

                const mockOrders = [{ _id: "o1" }, { _id: "o2" }];

                // Mimic: orderModel.find(...).populate(...).populate(...) -> resolves orders
                const populate2 = jest.fn().mockResolvedValue(mockOrders);
                const populate1 = jest.fn().mockReturnValue({ populate: populate2 });

                orderModel.find.mockReturnValue({ populate: populate1 });

                await getOrdersController(req, res);

                expect(orderModel.find).toHaveBeenCalledWith({ buyer: "user123" });
                expect(populate1).toHaveBeenCalledWith("products", "-photo");
                expect(populate2).toHaveBeenCalledWith("buyer", "name");
                expect(res.json).toHaveBeenCalledWith(mockOrders);
            });

            it("should return 500 if database throws error", async () => {
                req.user = { _id: "user123" };

                orderModel.find.mockImplementation(() => {
                    throw new Error("DB Error");
                });

                await getOrdersController(req, res);

                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.send).toHaveBeenCalledWith(
                    expect.objectContaining({
                        success: false,
                        message: "Error while getting orders",
                    })
                );
            });
        });

        describe("getAllOrdersController", () => {
            it("should return all orders sorted by createdAt desc", async () => {
                const mockOrders = [{ _id: "o1" }];

                // Mimic: orderModel.find({}).populate(...).populate(...).sort(...) -> resolves orders
                const sortMock = jest.fn().mockResolvedValue(mockOrders);
                const populate2 = jest.fn().mockReturnValue({ sort: sortMock });
                const populate1 = jest.fn().mockReturnValue({ populate: populate2 });

                orderModel.find.mockReturnValue({ populate: populate1 });

                await getAllOrdersController(req, res);

                expect(orderModel.find).toHaveBeenCalledWith({});
                expect(populate1).toHaveBeenCalledWith("products", "-photo");
                expect(populate2).toHaveBeenCalledWith("buyer", "name");
                expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
                expect(res.json).toHaveBeenCalledWith(mockOrders);
            });

            it("should return 500 on error", async () => {
                orderModel.find.mockImplementation(() => {
                    throw new Error("DB Error");
                });

                await getAllOrdersController(req, res);

                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.send).toHaveBeenCalledWith(
                    expect.objectContaining({
                        success: false,
                        message: "Error while getting orders",
                    })
                );
            });
        });

        describe("orderStatusController", () => {
            it("should update order status and return updated order", async () => {
                req.params = { orderId: "order123" };
                req.body = { status: "Shipped" };

                const updated = { _id: "order123", status: "Shipped" };
                orderModel.findByIdAndUpdate.mockResolvedValue(updated);

                await orderStatusController(req, res);

                expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
                    "order123",
                    { status: "Shipped" },
                    { new: true }
                );
                expect(res.json).toHaveBeenCalledWith(updated);
            });

            it("should return 500 on error", async () => {
                req.params = { orderId: "order123" };
                req.body = { status: "Shipped" };

                orderModel.findByIdAndUpdate.mockRejectedValue(new Error("DB Error"));

                await orderStatusController(req, res);

                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.send).toHaveBeenCalledWith(
                    expect.objectContaining({
                        success: false,
                        message: "Error while updating order",
                    })
                );
            });
        });
    });

});
