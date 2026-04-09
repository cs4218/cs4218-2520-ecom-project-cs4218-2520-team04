// A0272558U, Teo Kai Xiang
// Written by GPT 5.4 based on test plans written by me. Reviewed after
import React from "react";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import axios from "axios";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";

import authRoute from "../../routes/authRoute.js";
import categoryRoutes from "../../routes/categoryRoutes.js";
import App from "../../client/src/App.js";
import userModel from "../../models/userModel.js";
import orderModel from "../../models/orderModel.js";
import productModel from "../../models/productModel.js";
import categoryModel from "../../models/categoryModel.js";
import { AuthProvider } from "../../client/src/context/auth.js";
import { CartProvider } from "../../client/src/context/cart.js";
import { SearchProvider } from "../../client/src/context/search.js";

jest.mock("axios");
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
  Toaster: () => null,
}));

process.env.JWT_SECRET = "test-jwt-secret-authorization-security";

const AllProviders = ({ children }) => (
  <AuthProvider>
    <SearchProvider>
      <CartProvider>{children}</CartProvider>
    </SearchProvider>
  </AuthProvider>
);

let mongod;
let app;

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoute);
  app.use("/api/v1/category", categoryRoutes);
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  axios.get.mockReset();
  axios.post.mockReset();
  axios.put.mockReset();
});

afterEach(async () => {
  await orderModel.deleteMany({});
  await productModel.deleteMany({});
  await categoryModel.deleteMany({});
  await userModel.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});

const signToken = (userId) =>
  jwt.sign({ _id: userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

const seedUsers = async () => {
  const [customer, otherCustomer, admin] = await userModel.create([
    {
      name: "Customer One",
      email: "customer-one@test.com",
      password: "StrongPass1!",
      phone: "80000021",
      address: "21 User Street",
      answer: "blue",
      role: 0,
    },
    {
      name: "Customer Two",
      email: "customer-two@test.com",
      password: "StrongPass1!",
      phone: "80000022",
      address: "22 User Street",
      answer: "green",
      role: 0,
    },
    {
      name: "Admin One",
      email: "admin-one@test.com",
      password: "StrongPass1!",
      phone: "80000023",
      address: "23 Admin Street",
      answer: "red",
      role: 1,
    },
  ]);

  return { customer, otherCustomer, admin };
};

const seedOrderForBuyer = async (buyerId, suffix) => {
  const category = await categoryModel.create({
    name: `Orders ${suffix}`,
    slug: `orders-${suffix}`,
  });
  const product = await productModel.create({
    name: `Product ${suffix}`,
    slug: `product-${suffix}`,
    description: `Product ${suffix} description`,
    price: 25,
    category: category._id,
    quantity: 10,
  });

  return orderModel.create({
    products: [product._id],
    payment: { transaction: { id: `txn-${suffix}` } },
    buyer: buyerId,
    status: "Not Process",
  });
};

describe("Authorization security testing - backend", () => {
  test("customer token cannot call admin-only APIs directly", async () => {
    const { customer } = await seedUsers();
    const customerToken = signToken(customer._id);

    const [allOrdersResponse, usersResponse, createCategoryResponse] =
      await Promise.all([
        request(app)
          .get("/api/v1/auth/all-orders")
          .set("Authorization", customerToken),
        request(app)
          .get("/api/v1/auth/users")
          .set("Authorization", customerToken),
        request(app)
          .post("/api/v1/category/create-category")
          .set("Authorization", customerToken)
          .send({ name: "Illicit Category" }),
      ]);

    expect(allOrdersResponse.status).toBe(401);
    expect(allOrdersResponse.body.message).toBe("UnAuthorized Access");
    expect(usersResponse.status).toBe(401);
    expect(usersResponse.body.message).toBe("UnAuthorized Access");
    expect(createCategoryResponse.status).toBe(401);
    expect(createCategoryResponse.body.message).toBe("UnAuthorized Access");
    expect(await categoryModel.countDocuments({})).toBe(0);
  });

  test("customer cannot update another customer's order by tampering with the orderId on the admin endpoint", async () => {
    const { customer, otherCustomer } = await seedUsers();
    const customerToken = signToken(customer._id);
    const otherUsersOrder = await seedOrderForBuyer(
      otherCustomer._id,
      "victim",
    );

    const response = await request(app)
      .put(`/api/v1/auth/order-status/${otherUsersOrder._id}`)
      .set("Authorization", customerToken)
      .send({ status: "Shipped" });

    const unchangedOrder = await orderModel.findById(otherUsersOrder._id);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("UnAuthorized Access");
    expect(unchangedOrder.status).toBe("Not Process");
  });

  test("orders endpoint only returns the authenticated customer's orders", async () => {
    const { customer, otherCustomer } = await seedUsers();
    const customerToken = signToken(customer._id);
    const customersOrder = await seedOrderForBuyer(customer._id, "customer");
    await seedOrderForBuyer(otherCustomer._id, "other-customer");

    const response = await request(app)
      .get("/api/v1/auth/orders")
      .set("Authorization", customerToken);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]._id).toBe(customersOrder._id.toString());
    expect(response.body[0].buyer._id || response.body[0].buyer).toBe(
      customer._id.toString(),
    );
  });

  test("profile updates use the authenticated user and ignore a tampered userId in the payload", async () => {
    const { customer, otherCustomer } = await seedUsers();
    const customerToken = signToken(customer._id);

    const response = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", customerToken)
      .send({
        _id: otherCustomer._id.toString(),
        name: "Customer One Updated",
        address: "Updated Own Address",
      });

    const updatedCustomer = await userModel.findById(customer._id);
    const untouchedVictim = await userModel.findById(otherCustomer._id);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(updatedCustomer.name).toBe("Customer One Updated");
    expect(updatedCustomer.address).toBe("Updated Own Address");
    expect(untouchedVictim.name).toBe("Customer Two");
    expect(untouchedVictim.address).toBe("22 User Street");
  });
});

describe("Authorization security testing - frontend", () => {
  test("manual navigation to an admin page does not render admin content when the server rejects admin-auth", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: {
          _id: "customer-id",
          name: "Customer One",
          role: 0,
        },
        token: "customer-token",
      }),
    );

    axios.get.mockImplementation((url) => {
      if (url === "/api/v1/category/get-category") {
        return Promise.resolve({ data: { category: [] } });
      }
      if (url === "/api/v1/auth/admin-auth") {
        return Promise.reject({
          response: {
            status: 401,
            data: { success: false, message: "UnAuthorized Access" },
          },
        });
      }
      if (url === "/api/v1/auth/users") {
        return Promise.resolve({ data: { success: true, users: [] } });
      }

      return Promise.resolve({ data: {} });
    });

    render(
      <AllProviders>
        <MemoryRouter initialEntries={["/dashboard/admin/users"]}>
          <App />
        </MemoryRouter>
      </AllProviders>,
    );

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/admin-auth");
    });

    expect(screen.getByText(/redirecting to you in/i)).toBeInTheDocument();
    expect(screen.queryByText("All Users")).not.toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalledWith("/api/v1/auth/users");
  });
});
