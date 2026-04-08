// Tan Wei Lian, A0269750U
//
// Playwright globalSetup — seeds a test order in MongoDB so the admin-orders
// status-change test always has data regardless of DB state.
// The seeded order ID is written to a temp file for teardown to clean up.

import mongoose from "mongoose";
import dotenv from "dotenv";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { seedPlaywrightAdminUser } from "./seedTestUsers.js";
import { getTestMongoUrl } from "./testMongoUrl.js";

dotenv.config();

const orderSchema = new mongoose.Schema(
  {
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Products" }],
    payment: { type: Object },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    status: {
      type: String,
      default: "Not Process",
      enum: ["Not Process", "Processing", "Shipped", "delivered", "cancel"],
    },
  },
  { timestamps: true }
);

export default async function globalSetup() {
  await mongoose.connect(getTestMongoUrl());

  // Ensure the shared Playwright admin account exists before seeding order data.
  const user = await seedPlaywrightAdminUser();

  // Seed one test order with a recognisable marker in payment
  const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
  const order = await Order.create({
    products: [],
    payment: { success: false, _playwright_seed: true },
    buyer: user._id,
    status: "Not Process",
  });

  // Seed a category and product so ProductDetails / CategoryProduct tests have data.
  // Use raw collection ops to avoid OverwriteModelError when test specs later
  // import the canonical model files.
  const db = mongoose.connection.db;
  const now = new Date();

  const categoryResult = await db.collection("categories").findOneAndUpdate(
    { slug: "playwright-seed-category" },
    {
      $set: { name: "Playwright Seed Category", slug: "playwright-seed-category" },
      $setOnInsert: { _id: new mongoose.Types.ObjectId() },
    },
    { upsert: true, returnDocument: "after" }
  );
  const category = categoryResult;

  const productResult = await db.collection("products").findOneAndUpdate(
    { slug: "playwright-seed-product" },
    {
      $set: {
        name: "Playwright Seed Product",
        slug: "playwright-seed-product",
        description: "A seeded product for Playwright UI tests",
        price: 29.99,
        category: category._id,
        quantity: 10,
        shipping: true,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new mongoose.Types.ObjectId(),
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  const product = productResult;

  // Persist IDs for teardown
  const tmpDir = join(process.cwd(), "playwright");
  // Ensure the playwright/ folder exists before writing seed metadata (prevents ENOENT on fresh machines/CI)
  mkdirSync(tmpDir, { recursive: true });

  const tmpPath = join(tmpDir, ".seed-order-id.json");
  writeFileSync(
    tmpPath,
    JSON.stringify({
      orderId: order._id.toString(),
      categoryId: category._id.toString(),
      productId: product._id.toString(),
    })
  );

  await mongoose.disconnect();
}
