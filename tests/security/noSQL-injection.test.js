// A0272558U, Teo Kai Xiang
// Written by GPT 5.4 based on test plans written by me. Reviewed after

import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

import authRoute from "../../routes/authRoute.js";
import categoryRoutes from "../../routes/categoryRoutes.js";
import productRoutes from "../../routes/productRoutes.js";
import userModel from "../../models/userModel.js";
import categoryModel from "../../models/categoryModel.js";
import productModel from "../../models/productModel.js";
import { hashPassword } from "../../helpers/authHelper.js";

process.env.JWT_SECRET = "test-jwt-secret-nosql-security";

let mongod;
let app;

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoute);
  app.use("/api/v1/category", categoryRoutes);
  app.use("/api/v1/product", productRoutes);
});

afterEach(async () => {
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

const seedCustomer = async () => {
  const hashedPassword = await hashPassword("StrongPass1!");

  return userModel.create({
    name: "NoSQL Test User",
    email: "nosql-user@test.com",
    password: hashedPassword,
    phone: "80000051",
    address: "51 Query Street",
    answer: "blue",
    role: 0,
  });
};

const seedAdmin = async () => {
  const hashedPassword = await hashPassword("StrongPass1!");

  return userModel.create({
    name: "NoSQL Admin",
    email: "nosql-admin@test.com",
    password: hashedPassword,
    phone: "80000052",
    address: "52 Admin Street",
    answer: "red",
    role: 1,
  });
};

describe("NoSQL injection security testing", () => {
  test("login rejects Mongo operator objects instead of authenticating or crashing", async () => {
    await seedCustomer();

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: { $ne: null },
        password: { $ne: null },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid email or password",
    });
  });

  test("register rejects operator payloads for user-controlled fields", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Injected User",
        email: { $gt: "" },
        password: "StrongPass1!",
        phone: "80000053",
        address: "53 User Street",
        answer: { $ne: null },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid input format. Fields must be text strings.",
    });
    expect(await userModel.countDocuments({})).toBe(0);
  });

  test("forgot-password rejects non-string operator payloads", async () => {
    await seedCustomer();

    const response = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({
        email: { $ne: null },
        answer: { $ne: null },
        newPassword: "StrongPass1!",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid input format. Fields must be text strings.",
    });
  });

  test("profile update rejects operator objects instead of merging them into the query/update", async () => {
    const customer = await seedCustomer();

    const response = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", signToken(customer._id))
      .send({
        name: { $ne: null },
        phone: "89999999",
      });

    const unchangedUser = await userModel.findById(customer._id);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid input format. Fields must be text strings.",
    });
    expect(unchangedUser.name).toBe("NoSQL Test User");
    expect(unchangedUser.phone).toBe("80000051");
  });

  test("admin category creation rejects operator objects for the category name", async () => {
    const admin = await seedAdmin();

    const response = await request(app)
      .post("/api/v1/category/create-category")
      .set("Authorization", signToken(admin._id))
      .send({
        name: { $regex: ".*" },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid input format. Fields must be text strings.",
    });
    expect(await categoryModel.countDocuments({})).toBe(0);
  });

  test("stringified operator payloads in search stay inert and do not broaden Mongo queries", async () => {
    const category = await categoryModel.create({
      name: "NoSQL Category",
      slug: "nosql-category",
    });

    await productModel.create({
      name: "Laptop",
      slug: "laptop",
      description: "A fast laptop",
      price: 1000,
      category: category._id,
      quantity: 3,
    });

    const response = await request(app).get(
      `/api/v1/product/search/${encodeURIComponent('{"$ne":null}')}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
