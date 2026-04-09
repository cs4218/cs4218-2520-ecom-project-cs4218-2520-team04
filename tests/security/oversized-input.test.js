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

process.env.JWT_SECRET = "test-jwt-secret-oversized-security";

let mongod;
let app;

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(express.json({ limit: "2mb" }));
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

const seedAdmin = async () =>
  userModel.create({
    name: "Oversized Admin",
    email: "oversized-admin@test.com",
    password: "StrongPass1!",
    phone: "80000041",
    address: "41 Admin Street",
    answer: "red",
    role: 1,
  });

describe("Oversized input security testing", () => {
  test("register rejects oversized profile fields safely", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "A".repeat(101),
        email: "oversized@test.com",
        password: "StrongPass1!",
        phone: "80000042",
        address: "B".repeat(501),
        answer: "blue",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Name is too long");
    expect(await userModel.countDocuments({})).toBe(0);
  });

  test("category creation rejects oversized names for admin requests", async () => {
    const admin = await seedAdmin();
    const response = await request(app)
      .post("/api/v1/category/create-category")
      .set("Authorization", signToken(admin._id))
      .send({ name: "C".repeat(101) });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Name is too long",
    });
    expect(await categoryModel.countDocuments({})).toBe(0);
  });

  test("search rejects excessively long keywords without hitting product lookup logic", async () => {
    const response = await request(app).get(
      `/api/v1/product/search/${"k".repeat(101)}`,
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Search keyword is too long",
    });
  });

  test("product creation rejects oversized photo uploads", async () => {
    const admin = await seedAdmin();
    const category = await categoryModel.create({
      name: "Oversized Products",
      slug: "oversized-products",
    });

    const response = await request(app)
      .post("/api/v1/product/create-product")
      .set("Authorization", signToken(admin._id))
      .field("name", "Big Photo Product")
      .field("description", "A product with an oversized photo")
      .field("price", "50")
      .field("category", category._id.toString())
      .field("quantity", "1")
      .attach("photo", Buffer.alloc(1000001, 1), {
        filename: "oversized.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Photo should be less than 1mb",
    });
    expect(await productModel.countDocuments({})).toBe(0);
  });
});
