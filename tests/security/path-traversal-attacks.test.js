// A0272558U, Teo Kai Xiang
// Written by GPT 5.4 based on test plans written by me. Reviewed after

import React from "react";
import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MemoryRouter } from "react-router-dom";
import { act, render } from "@testing-library/react";

import productRoutes from "../../routes/productRoutes.js";
import Spinner from "../../client/src/components/Spinner.js";

const mockNavigate = jest.fn();
const mockLocation = { pathname: "/dashboard/admin" };

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

let mongod;
let app;

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(express.json());
  app.use("/api/v1/product", productRoutes);
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});

describe("Path traversal security testing", () => {
  test("spinner blocks traversal-like frontend redirect targets", () => {
    render(
      <MemoryRouter>
        <Spinner path={"admin/../secrets"} />
      </MemoryRouter>,
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockNavigate).toHaveBeenCalledWith("/login", {
      state: mockLocation.pathname,
    });
    expect(console.warn).toHaveBeenCalled();
  });

  test("product photo route does not interpret traversal strings as filesystem paths", async () => {
    const response = await request(app).get(
      "/api/v1/product/product-photo/..%2F..%2Fwindows%2Fwin.ini",
    );

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Error while getting photo");
    expect(JSON.stringify(response.body)).not.toContain("[fonts]");
    expect(JSON.stringify(response.body)).not.toContain("root:");
  });
});
