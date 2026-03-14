//
// Tan Wei Lian, A0269750U
//
// Integration tests for category routes + controller + middleware + model.
// Tests go through the full HTTP stack using supertest:
//   route → requireSignIn → isAdmin → categoryController → categoryModel (real MongoDB)
// This verifies not just controller logic but also:
//   - Auth middleware correctly blocks unauthenticated / non-admin requests
//   - URL routing is correctly wired to the controller
//   - Cross-model interactions (category ↔ product) work end-to-end

import mongoose from "mongoose";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import categoryRoutes from "../../routes/categoryRoutes.js";
import categoryModel from "../../models/categoryModel.js";
import productModel from "../../models/productModel.js";
import userModel from "../../models/userModel.js";

// Use a fixed test secret so auth middleware and token signing agree
process.env.JWT_SECRET = "test-jwt-secret-integration";

// Suppress console.log from middleware (expected JWT errors in auth tests)
beforeEach(() => jest.spyOn(console, "log").mockImplementation(() => {}));

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Minimal Express app — only what's needed for category routes
  app = express();
  app.use(express.json());
  app.use("/api/v1/category", categoryRoutes);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await categoryModel.deleteMany({});
  await productModel.deleteMany({});
});

// ─── Auth middleware integration ───────────────────────────────────────────

// Tan Wei Lian, A0269750U
describe("Auth middleware — protected category routes", () => {
  test("POST /create-category returns 401 with no Authorization header", async () => {
    const res = await request(app)
      .post("/api/v1/category/create-category")
      .send({ name: "Books" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  test("POST /create-category returns 401 with an invalid token", async () => {
    const res = await request(app)
      .post("/api/v1/category/create-category")
      .set("Authorization", "not-a-valid-jwt")
      .send({ name: "Books" });

    expect(res.status).toBe(401);
  });

  test("POST /create-category returns 401 when user is not admin (role 0)", async () => {
    // Create a regular (non-admin) user
    const user = await userModel.create({
      name: "Regular User",
      email: "regular@test.com",
      password: "pass123",
      phone: "99999999",
      address: "1 User Street",
      answer: "test",
      role: 0,
    });
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    const res = await request(app)
      .post("/api/v1/category/create-category")
      .set("Authorization", token)
      .send({ name: "Books" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("UnAuthorized Access");

    await userModel.deleteOne({ _id: user._id });
  });
});

// ─── Admin category CRUD ────────────────────────────────────────────────────

// Tan Wei Lian, A0269750U
describe("Category CRUD — admin authenticated requests via full HTTP stack", () => {
  let adminToken;

  beforeAll(async () => {
    const admin = await userModel.create({
      name: "Admin User",
      email: "admin@test.com",
      password: "admin123",
      phone: "88888888",
      address: "1 Admin Road",
      answer: "admin-answer",
      role: 1,
    });
    adminToken = jwt.sign(
      { _id: admin._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    await userModel.deleteOne({ email: "admin@test.com" });
  });

  describe("POST /api/v1/category/create-category", () => {
    test("creates a new category and persists it in the real DB", async () => {
      const res = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", adminToken)
        .send({ name: "Electronics" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.category.name).toBe("Electronics");

      // Verify real DB write
      const saved = await categoryModel.findOne({ name: "Electronics" });
      expect(saved).not.toBeNull();
    });

    test("returns 409 when the category name already exists in the DB", async () => {
      await categoryModel.create({ name: "Books", slug: "books" });

      const res = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", adminToken)
        .send({ name: "Books" });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Category Already Exists");

      // Only one document should exist
      expect(await categoryModel.countDocuments({ name: "Books" })).toBe(1);
    });

    test("returns 400 when name is missing", async () => {
      const res = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", adminToken)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Name is required");
    });

    test("returns 400 when name is only whitespace", async () => {
      const res = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", adminToken)
        .send({ name: "   " });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/v1/category/update-category/:id", () => {
    test("updates the category name in the real DB and returns 200", async () => {
      const cat = await categoryModel.create({ name: "OldName", slug: "oldname" });

      const res = await request(app)
        .put(`/api/v1/category/update-category/${cat._id}`)
        .set("Authorization", adminToken)
        .send({ name: "NewName" });

      expect(res.status).toBe(200);
      expect(res.body.category.name).toBe("NewName");

      // Verify DB record changed
      const updated = await categoryModel.findById(cat._id);
      expect(updated.name).toBe("NewName");
    });

    test("returns 404 when the category ID does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .put(`/api/v1/category/update-category/${fakeId}`)
        .set("Authorization", adminToken)
        .send({ name: "Anything" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Category not found");
    });

    test("returns 400 when name is missing", async () => {
      const cat = await categoryModel.create({ name: "Test", slug: "test" });

      const res = await request(app)
        .put(`/api/v1/category/update-category/${cat._id}`)
        .set("Authorization", adminToken)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/category/delete-category/:id", () => {
    test("deletes the category from the real DB and returns 200", async () => {
      const cat = await categoryModel.create({ name: "ToDelete", slug: "to-delete" });

      const res = await request(app)
        .delete(`/api/v1/category/delete-category/${cat._id}`)
        .set("Authorization", adminToken);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Category Deleted Successfully");

      expect(await categoryModel.findById(cat._id)).toBeNull();
    });

    test("returns 400 when category has associated products (cross-model check via HTTP)", async () => {
      const cat = await categoryModel.create({ name: "HasProducts", slug: "has-products" });
      await productModel.create({
        name: "Widget",
        slug: "widget",
        description: "A widget",
        price: 9.99,
        category: cat._id,
        quantity: 10,
      });

      const res = await request(app)
        .delete(`/api/v1/category/delete-category/${cat._id}`)
        .set("Authorization", adminToken);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Cannot delete category with associated products");

      // Category must still exist
      expect(await categoryModel.findById(cat._id)).not.toBeNull();
    });

    test("returns 404 when the category ID does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .delete(`/api/v1/category/delete-category/${fakeId}`)
        .set("Authorization", adminToken);

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/category/get-category (public route)", () => {
    test("returns all categories from the real DB — no auth required", async () => {
      await categoryModel.insertMany([
        { name: "Alpha", slug: "alpha" },
        { name: "Beta", slug: "beta" },
      ]);

      const res = await request(app).get("/api/v1/category/get-category");

      expect(res.status).toBe(200);
      expect(res.body.category).toHaveLength(2);
      const names = res.body.category.map((c) => c.name);
      expect(names).toContain("Alpha");
      expect(names).toContain("Beta");
    });
  });

  describe("Full lifecycle via HTTP — create → list → update → delete", () => {
    test("complete admin category workflow through the full HTTP stack", async () => {
      // Step 1: Create
      const createRes = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", adminToken)
        .send({ name: "Lifestyle" });
      expect(createRes.status).toBe(201);
      const catId = createRes.body.category._id;

      // Step 2: List (public)
      const listRes = await request(app).get("/api/v1/category/get-category");
      expect(listRes.body.category.find((c) => c._id === catId)).toBeDefined();

      // Step 3: Update
      const updateRes = await request(app)
        .put(`/api/v1/category/update-category/${catId}`)
        .set("Authorization", adminToken)
        .send({ name: "Health & Lifestyle" });
      expect(updateRes.status).toBe(200);

      // Verify in DB
      const afterUpdate = await categoryModel.findById(catId);
      expect(afterUpdate.name).toBe("Health & Lifestyle");

      // Step 4: Delete
      const deleteRes = await request(app)
        .delete(`/api/v1/category/delete-category/${catId}`)
        .set("Authorization", adminToken);
      expect(deleteRes.status).toBe(200);
      expect(await categoryModel.findById(catId)).toBeNull();
    });

    test("delete blocked by products, then succeeds after product removed — through HTTP stack", async () => {
      // Create category via HTTP
      const createRes = await request(app)
        .post("/api/v1/category/create-category")
        .set("Authorization", adminToken)
        .send({ name: "Furniture" });
      const catId = createRes.body.category._id;

      // Add product directly to DB
      const product = await productModel.create({
        name: "Chair",
        slug: "chair",
        description: "A comfy chair",
        price: 49.99,
        category: catId,
        quantity: 5,
      });

      // Delete attempt → blocked
      const blockedRes = await request(app)
        .delete(`/api/v1/category/delete-category/${catId}`)
        .set("Authorization", adminToken);
      expect(blockedRes.status).toBe(400);

      // Remove product, then delete succeeds
      await productModel.findByIdAndDelete(product._id);

      const deleteRes = await request(app)
        .delete(`/api/v1/category/delete-category/${catId}`)
        .set("Authorization", adminToken);
      expect(deleteRes.status).toBe(200);
    });
  });
});
