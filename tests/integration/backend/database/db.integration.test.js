/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * Integration tests for db.js
 * 
 * connectDB() is the only application module under test. It is verified against
 * a real in-memory MongoDB instance (MongoMemoryServer) rather than a mock 
 * This is a module-level integration test the integration boundary between
 * connectDB and its external dependency (Mongoose + MongoDB).
 *
 * Integrated parts:   connectDB, Mongoose, MongoMemoryServer
 * Mocked parts: mongoose.connect (only in error simulation tests)
 *
 * Test coverage
 * ─────────────
 * 1. Successful connection sets Mongoose readyState to 1
 * 2. Successful connection logs the expected success message
 * 3. Failed connection logs the expected error message
 * 4. Successful reconnection is possible after a prior failure
 * 
 * Test suite description is generated with reference to AI and edited.
 */
import mongoose from "mongoose";
import connectDB from "../../../../config/db";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer; // For in-memory MongoDB server

// Creates a new in-memory MongoDB server
beforeAll(async () => { // catch the promise
    mongoServer = await MongoMemoryServer.create(); // returns a promise
});

// silence all logs
beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
});

// Disconnect connection to in-memory MongoDB after each test to ensure clean state for the next test
afterEach(async () => {
    jest.restoreAllMocks();
    if (mongoose.connection.readyState !== 0) { 
        await mongoose.disconnect();
    }
});

// Shutdown server after all tests
afterAll(async () => {
    await mongoServer.stop(); 
    jest.restoreAllMocks();
});

it("should connect to MongoDB successfully with a ready state of 1", async () => {
    // Arrange - Get the URI of the in-memory MongoDB server
    process.env.MONGO_URL = mongoServer.getUri();

    // Act - Connect to the in-memory MongoDB server
    await connectDB(); 

    // Assert - Check if the connection state is 1 (connected)
    expect(mongoose.connection.readyState).toBe(1); 
});

it("should log a success message if connection to MongoDB is successful", async () => {
    // Arrange - Mock console.log and set MONGO_URL to the in-memory MongoDB server URI
    const mockConsoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    process.env.MONGO_URL = mongoServer.getUri();

    // Act - Connect to the in-memory MongoDB server
    await connectDB();

    // Assert - Check if console.log was called with the expected success message
    expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Connected To Mongodb Database")
    );
});

it("should log an error message if connection to MongoDB fails", async () => {
    // Arrange - Mock mongoose.connect to reject with an error and mock console.log to capture the error message
    jest.spyOn(mongoose, "connect").mockRejectedValue(new Error("Connection failed"));
    const mockConsoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    process.env.MONGO_URL = mongoServer.getUri();

    // Act - Attempt to connect to MongoDB which will fail due to the mocked rejection
    await connectDB();

    // Assert - Check if console.log was called with the expected error message
    expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Error in Mongodb")
    );
});

it("should allow for subsequent successful connection to MongoDB after a failed connection attempt", async () => {
    // First attempt to connect to MongoDB should fail
    jest.spyOn(mongoose, "connect").mockRejectedValueOnce(new Error("Connection failed"));
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    process.env.MONGO_URL = mongoServer.getUri();
    await connectDB();

    // Check if console.log was called with the expected error message
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error in Mongodb")
    );
 
    // Restore mocks to allow for a successful connection on the second attempt
    jest.restoreAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});

    // Second attempt to connect to MongoDB should succeed
    process.env.MONGO_URL = mongoServer.getUri();
    await connectDB();
    expect(mongoose.connection.readyState).toBe(1);
});

