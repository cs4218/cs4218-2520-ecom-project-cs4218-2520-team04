// Tan Wei Lian, A0269750U
//
// Playwright globalSetup — seeds a test order in MongoDB so the admin-orders
// status-change test always has data regardless of DB state.
// The seeded order ID is written to a temp file for teardown to clean up.

import mongoose from "mongoose";
import dotenv from "dotenv";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

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
  await mongoose.connect(process.env.MONGO_URL);

  // Find the test admin user
  const user = await mongoose.connection.db
    .collection("users")
    .findOne({ email: "test@admin.com" });

  if (!user) {
    console.warn("[global-setup] test@admin.com not found — orders test may skip");
    await mongoose.disconnect();
    return;
  }

  // Seed one test order with a recognisable marker in payment
  const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
  const order = await Order.create({
    products: [],
    payment: { success: false, _playwright_seed: true },
    buyer: user._id,
    status: "Not Process",
  });

  // Persist ID for teardown
  const tmpDir = join(process.cwd(), "playwright");
  // Ensure the playwright/ folder exists before writing seed metadata (prevents ENOENT on fresh machines/CI)
  mkdirSync(tmpDir, { recursive: true });

  const tmpPath = join(tmpDir, ".seed-order-id.json");
  writeFileSync(tmpPath, JSON.stringify({ orderId: order._id.toString() }));

  await mongoose.disconnect();
}
