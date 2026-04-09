// A0272558U, Teo Kai Xiang
// Written by GPT 5.4 based on test plans written by me. Reviewed after

import React from "react";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import axios from "axios";
import toast from "react-hot-toast";
import { MongoMemoryServer } from "mongodb-memory-server";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import authRoute from "../../routes/authRoute.js";
import userModel from "../../models/userModel.js";
import { hashPassword } from "../../helpers/authHelper.js";
import {
  configureLoginProtectionForTests,
  resetLoginProtectionState,
} from "../../helpers/loginProtection.js";
import {
  PASSWORD_POLICY_HINT,
  PASSWORD_POLICY_MESSAGE,
} from "../../helpers/passwordPolicy.js";
import { AuthProvider } from "../../client/src/context/auth.js";
import { CartProvider } from "../../client/src/context/cart.js";
import { SearchProvider } from "../../client/src/context/search.js";
import Login from "../../client/src/pages/Auth/Login.js";
import Register from "../../client/src/pages/Auth/Register.js";

jest.mock("axios");
jest.mock("react-hot-toast");

process.env.JWT_SECRET = "test-jwt-secret-security";

const AllProviders = ({ children }) => (
  <AuthProvider>
    <SearchProvider>
      <CartProvider>{children}</CartProvider>
    </SearchProvider>
  </AuthProvider>
);

const baseRegisterFields = {
  name: "Security Tester",
  phone: "98765432",
  address: "123 Security Ave",
  dob: "2000-01-01",
  answer: "Football",
};

let mongod;
let app;

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoute);
});

beforeEach(() => {
  resetLoginProtectionState();
  configureLoginProtectionForTests({
    maxAttempts: 5,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000,
  });

  jest.clearAllMocks();
  axios.get.mockReset();
  axios.post.mockReset();
  toast.error.mockReset();
  toast.success.mockReset();
  axios.get.mockResolvedValue({ data: { category: [] } });
  localStorage.clear();
});

afterEach(async () => {
  resetLoginProtectionState();
  await userModel.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});

const seedUser = async ({
  email = "member@example.com",
  password = "StrongPass1!",
} = {}) => {
  const hashedPassword = await hashPassword(password);

  return userModel.create({
    name: "Member",
    email,
    password: hashedPassword,
    phone: "90000000",
    address: "1 Test St",
    answer: "blue",
    role: 0,
  });
};

const signToken = (userId) =>
  jwt.sign({ _id: userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

const fillRegisterForm = async ({ email, password }) => {
  await userEvent.clear(screen.getByPlaceholderText("Enter Your Name"));
  await userEvent.type(
    screen.getByPlaceholderText("Enter Your Name"),
    baseRegisterFields.name,
  );
  await userEvent.clear(screen.getByPlaceholderText("Enter Your Email"));
  await userEvent.type(screen.getByPlaceholderText("Enter Your Email"), email);
  await userEvent.clear(screen.getByPlaceholderText("Enter Your Password"));
  await userEvent.type(
    screen.getByPlaceholderText("Enter Your Password"),
    password,
  );
  await userEvent.clear(screen.getByPlaceholderText("Enter Your Phone"));
  await userEvent.type(
    screen.getByPlaceholderText("Enter Your Phone"),
    baseRegisterFields.phone,
  );
  await userEvent.clear(screen.getByPlaceholderText("Enter Your Address"));
  await userEvent.type(
    screen.getByPlaceholderText("Enter Your Address"),
    baseRegisterFields.address,
  );
  await userEvent.clear(screen.getByPlaceholderText("Enter Your DOB"));
  await userEvent.type(
    screen.getByPlaceholderText("Enter Your DOB"),
    baseRegisterFields.dob,
  );
  await userEvent.clear(
    screen.getByPlaceholderText("What is Your Favorite sports"),
  );
  await userEvent.type(
    screen.getByPlaceholderText("What is Your Favorite sports"),
    baseRegisterFields.answer,
  );
};

describe("Authentication strength testing - backend", () => {
  test("rate-limits failed login attempts per IP across 100 rapid requests and keeps the server responsive", async () => {
    await seedUser();

    const responses = await Promise.all(
      Array.from({ length: 100 }, (_, attempt) =>
        request(app)
          .post("/api/v1/auth/login")
          .send({
            email: `probe-${attempt}@example.com`,
            password: "WrongPass1!",
          }),
      ),
    );

    responses
      .filter((response) => response.status !== 429)
      .forEach((response) => {
        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid email or password");
      });

    const postBurstThrottleResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "after-burst@example.com",
        password: "WrongPass1!",
      });

    expect(postBurstThrottleResponse.status).toBe(429);
    expect(postBurstThrottleResponse.body.message).toBe(
      "Too many failed login attempts. Please try again later.",
    );

    const blockedHealthyLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "member@example.com",
        password: "StrongPass1!",
      });

    expect(blockedHealthyLoginResponse.status).toBe(429);

    const serverStillResponsiveResponse = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Responsive User",
        email: "responsive@example.com",
        password: "StrongPass1!",
        phone: "91234567",
        address: "Health Check Ave",
        answer: "blue",
      });

    expect(serverStillResponsiveResponse.status).toBe(201);
    expect(serverStillResponsiveResponse.body.success).toBe(true);
  });

  test("returns the same generic login error for existing and non-existing emails", async () => {
    await seedUser();

    const existingEmailResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "member@example.com",
        password: "WrongPass1!",
      });

    const unknownEmailResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "unknown@example.com",
        password: "WrongPass1!",
      });

    expect(existingEmailResponse.status).toBe(401);
    expect(unknownEmailResponse.status).toBe(401);
    expect(existingEmailResponse.body).toEqual({
      success: false,
      message: "Invalid email or password",
    });
    expect(unknownEmailResponse.body).toEqual({
      success: false,
      message: "Invalid email or password",
    });
  });

  test("rejects weak password shapes on registration and profile update", async () => {
    const weakRegistrationShapes = [
      "1234567890",
      "passwordonly",
      "lowercase1!",
      "UPPERCASE1!",
      "NoSpecial123",
      "Short1!",
    ];

    for (let index = 0; index < weakRegistrationShapes.length; index += 1) {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Security Tester",
          email: `weak-${index}@example.com`,
          password: weakRegistrationShapes[index],
          phone: "98765432",
          address: "123 Security Ave",
          answer: "Football",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(PASSWORD_POLICY_MESSAGE);
    }

    const registeredResponse = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Security Tester",
        email: "strong@example.com",
        password: "StrongPass1!",
        phone: "98765432",
        address: "123 Security Ave",
        answer: "Football",
      });

    expect(registeredResponse.status).toBe(201);

    const savedUser = await userModel.findOne({ email: "strong@example.com" });
    const weakProfileResponse = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", signToken(savedUser._id))
      .send({
        password: "NoSpecial123",
      });

    expect(weakProfileResponse.status).toBe(400);
    expect(weakProfileResponse.body.message).toBe(PASSWORD_POLICY_MESSAGE);
  });
});

describe("Authentication strength testing - frontend", () => {
  test("login UI shows the same generic error for different email guesses", async () => {
    axios.post
      .mockRejectedValueOnce({
        response: {
          status: 401,
          data: { success: false, message: "Invalid email or password" },
        },
      })
      .mockRejectedValueOnce({
        response: {
          status: 401,
          data: { success: false, message: "Invalid email or password" },
        },
      });

    render(
      <AllProviders>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        </MemoryRouter>
      </AllProviders>,
    );

    await userEvent.type(
      screen.getByPlaceholderText("Enter Your Email"),
      "member@example.com",
    );
    await userEvent.type(
      screen.getByPlaceholderText("Enter Your Password"),
      "WrongPass1!",
    );
    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenNthCalledWith(
        1,
        "Invalid email or password",
      );
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^login$/i })).toBeEnabled();
    });

    await userEvent.clear(screen.getByPlaceholderText("Enter Your Email"));
    await userEvent.type(
      screen.getByPlaceholderText("Enter Your Email"),
      "unknown@example.com",
    );
    await userEvent.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenNthCalledWith(
        2,
        "Invalid email or password",
      );
    });

    expect(axios.post).toHaveBeenNthCalledWith(1, "/api/v1/auth/login", {
      email: "member@example.com",
      password: "WrongPass1!",
    });
    expect(axios.post).toHaveBeenNthCalledWith(2, "/api/v1/auth/login", {
      email: "unknown@example.com",
      password: "WrongPass1!",
    });
  });

  test("register UI advertises the password policy and surfaces backend strength errors for weak password shapes", async () => {
    axios.post.mockRejectedValue({
      response: {
        status: 400,
        data: { success: false, message: PASSWORD_POLICY_MESSAGE },
      },
    });

    render(
      <AllProviders>
        <MemoryRouter initialEntries={["/register"]}>
          <Routes>
            <Route path="/register" element={<Register />} />
          </Routes>
        </MemoryRouter>
      </AllProviders>,
    );

    const passwordInput = screen.getByPlaceholderText("Enter Your Password");
    expect(passwordInput).toHaveAttribute("minLength", "10");
    expect(passwordInput).toHaveAttribute("title", PASSWORD_POLICY_HINT);

    for (const weakPassword of ["1234567890", "passwordonly", "NoSpecial123"]) {
      await fillRegisterForm({
        email: `${weakPassword}@example.com`,
        password: weakPassword,
      });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /register/i })).toBeEnabled();
      });
      await userEvent.click(screen.getByRole("button", { name: /register/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenLastCalledWith(PASSWORD_POLICY_MESSAGE);
      });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /register/i })).toBeEnabled();
      });

      expect(axios.post).toHaveBeenLastCalledWith("/api/v1/auth/register", {
        name: baseRegisterFields.name,
        email: `${weakPassword}@example.com`,
        password: weakPassword,
        phone: baseRegisterFields.phone,
        address: baseRegisterFields.address,
        DOB: baseRegisterFields.dob,
        answer: baseRegisterFields.answer,
      });
    }
  });
});
