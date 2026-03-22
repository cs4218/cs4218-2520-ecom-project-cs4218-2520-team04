// Tan Wei Lian, A0269750U
//
// Playwright globalTeardown — removes the test order seeded by global-setup.js.

import mongoose from "mongoose";
import dotenv from "dotenv";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { getTestMongoUrl } from "./testMongoUrl.js";

dotenv.config();

export default async function globalTeardown() {
  const tmpPath = join(process.cwd(), "playwright", ".seed-order-id.json");
  if (!existsSync(tmpPath)) return;

  const { orderId } = JSON.parse(readFileSync(tmpPath, "utf8"));
  unlinkSync(tmpPath);

  await mongoose.connect(getTestMongoUrl());
  await mongoose.connection.db
    .collection("orders")
    .deleteOne({ _id: new mongoose.Types.ObjectId(orderId) });
  await mongoose.disconnect();
}
