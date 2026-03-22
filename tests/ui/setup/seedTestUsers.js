import mongoose from "mongoose";
import dotenv from "dotenv";
import userModel from "../../../models/userModel.js";
import { hashPassword } from "../../../helpers/authHelper.js";
import { getTestMongoUrl } from "./testMongoUrl.js";

dotenv.config();

const ensureMongoConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return;
  }

  if (mongoose.connection.readyState === 3) {
    await new Promise((resolve) => {
      mongoose.connection.once("disconnected", resolve);
    });
  }

  await mongoose.connect(getTestMongoUrl());
};

const upsertSeededUser = async ({
  name,
  email,
  password,
  phone,
  address,
  answer,
  role,
}) => {
  await ensureMongoConnection();

  const hashedPassword = await hashPassword(password);
  return userModel.findOneAndUpdate(
    { email },
    {
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      answer,
      role,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );
};

export const seedPlaywrightAdminUser = async () =>
  upsertSeededUser({
    name: "Playwright Admin",
    email: "test@admin.com",
    password: "test@admin.com",
    phone: "90000001",
    address: "1 Playwright Admin Street",
    answer: "playwright-admin",
    role: 1,
  });

export const seedPlaywrightNormalUser = async () =>
  upsertSeededUser({
    name: "Playwright User",
    email: "user@test.com",
    password: "user@test.com",
    phone: "90000002",
    address: "2 Playwright User Street",
    answer: "playwright-user",
    role: 0,
  });
