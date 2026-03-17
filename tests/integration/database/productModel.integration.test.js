/**
 * By: Yeo Yi Wen, A0273575U
 * Integration tests for productModel.js
 *
 * The Mongoose product schema is verified against a real in-memory MongoDB instance
 * (MongoMemoryServer). This is a module-level integration test — the single application
 * module under test (productModel) is integrated with its external dependency (MongoDB)
 * without any controllers or routes involved.
 *
 * Integrated parts:   productModel schema, Mongoose validation, MongoMemoryServer
 * Mocked parts:  Nothing — all operations hit a real (in-memory) database
 *
 * Test coverage
 * ─────────────
 * 1. Save       : required fields, optional fields, invalid field values
 * 2. Retrieval  : findById, findOne by each field, non-existent queries
 * 3. Update     : valid field updates, invalid value rejection, delete
 * 4. Timestamps : createdAt/updatedAt presence, updatedAt changes on modification
 *
 * Each test starts with an empty products collection (cleared in afterEach)
 * to ensure full isolation between tests.
 * 
 * Test suite description is generated with reference to AI and edited.
 */
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import productModel from "../../../models/productModel.js";

let mongoServer;

// Creates a new in-memory MongoDB server and connect to it before all tests
beforeAll(async () => { // catch the promise
    mongoServer = await MongoMemoryServer.create(); // returns a promise
    await mongoose.connect(mongoServer.getUri());
});

// Close mongoose connection and shut down in-memory MongoDB server after all tests
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop(); 
});

// Clear the products collection after each test to ensure a clean state for the next test
afterEach(async () => {
    await productModel.deleteMany({});
});

// Sample valid product data for testing required fields
const validProductData = {
    name: "Test Product",
    slug: "test-product",
    description: "This is a test product",
    price: 10.99,
    category: new mongoose.Types.ObjectId(), // Mock category ID
    quantity: 100,
};

// Happy path
describe("Product saves successfully", () => {
    it("should save a product successfully when all required fields are provided", async () => {
        // Arrange - Create a new product instance with valid data
        const product = new productModel(validProductData);

        // Act - Save the product to the database
        const savedProduct = await product.save();

        // Assert - Check if the saved product has an _id and matches the input data
        expect(savedProduct._id).toBeDefined();
        expect(savedProduct.name).toBe(validProductData.name);
        expect(savedProduct.slug).toBe(validProductData.slug);
        expect(savedProduct.description).toBe(validProductData.description);
        expect(savedProduct.price).toBe(validProductData.price);
        expect(savedProduct.category.toString()).toBe(validProductData.category.toString());
        expect(savedProduct.quantity).toBe(validProductData.quantity);
    });

    it("should not fail to save a product when optional fields are added", async () => {
        // Arrange - Create a new product instance with valid data and optional fields
        const productDataWithOptionalFields = {
            ...validProductData,
            photo: {
                data: Buffer.from("test photo data"),
                contentType: "image/png",
            },
            shipping: true,
        };
        const product = new productModel(productDataWithOptionalFields);

        // Act - Save the product to the database
        const savedProduct = await product.save();

        // Assert - Check if the saved product has the optional fields saved correctly
        expect(savedProduct._id).toBeDefined();
        expect(savedProduct.photo.data.toString()).toBe("test photo data");
        expect(savedProduct.photo.contentType).toBe("image/png");
        expect(savedProduct.shipping).toBe(true);
    });
});

describe("Product is not saved", () => {
    const requiredFields = ["name", "slug", "description", "price", "category", "quantity"];

    describe("Missing required fields", () => {
        // Test each required field by omitting it from the product data and expecting a validation error
        test.each(requiredFields)("should fail to save product if %s is missing",
            async (field) => {
                const data = { ...validProductData };
                delete data[field];
                const product = new productModel(data);
                await expect(product.save()).rejects.toThrow(mongoose.Error.ValidationError);
            }
        );
    });

    describe("Invalid field values", () => {
        const invalidCases = [
            { field: "price", value: -5, desc: "price is negative" },
            { field: "price", value: 0, desc: "price is zero" },
            { field: "quantity", value: -10, desc: "quantity is negative" },
        ];

        // Test invalid values for price and quantity, expecting a validation error
        test.each(invalidCases)(
            "should fail to save product if $desc",
            async ({ field, value }) => {
                const data = { ...validProductData, [field]: value };
                const product = new productModel(data);
                await expect(product.save()).rejects.toThrow(mongoose.Error.ValidationError);
            }
        );
    });
});

describe("Product data retrieval", () => {
    const productDataWithOptionalFields = {
        ...validProductData,
        photo: {
            data: Buffer.from("test photo data"),
            contentType: "image/png",
        },
        shipping: true,
    };

    describe("Retrieving existing product", () => {
        it("should retrieve a saved product successfully", async () => {
            const product = new productModel(productDataWithOptionalFields);
            const savedProduct = await product.save();
            const foundProduct = await productModel.findById(savedProduct._id);

            expect(foundProduct).toBeDefined();
            expect(foundProduct.name).toBe(productDataWithOptionalFields.name);
            expect(foundProduct.slug).toBe(productDataWithOptionalFields.slug);
            expect(foundProduct.description).toBe(productDataWithOptionalFields.description);
            expect(foundProduct.price).toBe(productDataWithOptionalFields.price);
            expect(foundProduct.category.toString()).toBe(productDataWithOptionalFields.category.toString());
            expect(foundProduct.quantity).toBe(productDataWithOptionalFields.quantity);
            expect(foundProduct.photo.data.toString()).toBe("test photo data");
            expect(foundProduct.photo.contentType).toBe("image/png");
            expect(foundProduct.shipping).toBe(true);
        });

        test.each([
            { field: "name", value: validProductData.name },
            { field: "slug", value: validProductData.slug },
            { field: "category", value: validProductData.category },
            { field: "price", value: validProductData.price },
            { field: "quantity", value: validProductData.quantity },
            { field: "shipping", value: productDataWithOptionalFields.shipping },
            { field: "photo.contentType", value: productDataWithOptionalFields.photo.contentType },
        ])("should retrieve product when searching by valid $field", async ({ field, value }) => {
            const product = new productModel(productDataWithOptionalFields);
            await product.save();
            const found = await productModel.findOne({ [field]: value });
            expect(found).toBeDefined();
            const actual = field.includes(".") // Handle nested field for photo.contentType
                ? field.split(".").reduce((obj, key) => obj?.[key], found)
                : found[field];
            expect(actual).toEqual(value);
        });
    });

    describe("Retrieving non-existent product", () => {
        it("should return null for a valid but non-existent ObjectId", async () => {
            const nonExistentId = new mongoose.Types.ObjectId();
            const found = await productModel.findById(nonExistentId);
            expect(found).toBeNull();
        });

        test.each([
            { field: "name", value: "NonExistentProductName" },
            { field: "slug", value: "non-existent-slug" },
            { field: "category", value: new mongoose.Types.ObjectId() },
            { field: "price", value: 9999 },
            { field: "quantity", value: 9999 },
            { field: "shipping", value: false },
            { field: "photo.contentType", value: "image/jpeg" },
        ])("should return null when searching by invalid $field", async ({ field, value }) => {
            const found = await productModel.findOne({ [field]: value });
            expect(found).toBeNull();
        });
    });
});

describe("Product data update", () => {
    const productDataWithOptionalFields = {
        ...validProductData,
        photo: {
            data: Buffer.from("test photo data"),
            contentType: "image/png",
        },
        shipping: true,
    };

    describe("Valid updates", () => {
        it("should delete a product successfully", async () => {
            const product = new productModel(productDataWithOptionalFields);
            const savedProduct = await product.save();
            await productModel.findByIdAndDelete(savedProduct._id);
            const foundProduct = await productModel.findById(savedProduct._id);
            expect(foundProduct).toBeNull();
        });

        test.each([
            { field: "name", value: "Updated Product Name" },
            { field: "slug", value: "updated-slug" },
            { field: "description", value: "Updated description" },
            { field: "price", value: 20.99 },
            { field: "category", value: new mongoose.Types.ObjectId() },
            { field: "quantity", value: 200 },
            { field: "photo", value: { data: Buffer.from("new photo data"), contentType: "image/jpeg" } },
            { field: "shipping", value: false },
        ])("should update product $field successfully", async ({ field, value }) => {
            const product = new productModel(productDataWithOptionalFields);
            const savedProduct = await product.save();
            savedProduct[field] = value;
            const updatedProduct = await savedProduct.save();

            if (field === "category") {
                expect(updatedProduct.category.toString()).toBe(value.toString());
            } else if (field === "photo") {
                expect(updatedProduct.photo.data.toString()).toBe(value.data.toString());
                expect(updatedProduct.photo.contentType).toBe(value.contentType);
            } else {
                expect(updatedProduct[field]).toBe(value);
            }
        });
    });

    // Invalid updates for price and quantity, expecting a validation error
    describe("Invalid updates", () => {
        test.each([
            { field: "price", value: -10, error: mongoose.Error.ValidationError },
            { field: "price", value: 0, error: mongoose.Error.ValidationError },
            { field: "quantity", value: -5, error: mongoose.Error.ValidationError },
        ])("should fail to update product with invalid $field = $value", async ({ field, value, error }) => {
            const product = new productModel(productDataWithOptionalFields);
            const savedProduct = await product.save();
            savedProduct[field] = value;
            await expect(savedProduct.save()).rejects.toThrow(error);
        });
    });
});

describe("Product timestamps", () => {
    it("should have valid timestamps after saving a product", async () => {
        // Arrange - Create a new product instance with valid data
        const product = new productModel(validProductData);

        // Act - Save the product to the database
        const savedProduct = await product.save();

        // Assert - Check if createdAt and updatedAt timestamps are defined and are valid Date objects
        expect(savedProduct.createdAt).toBeDefined();
        expect(savedProduct.updatedAt).toBeDefined();
        expect(savedProduct.createdAt).toBeInstanceOf(Date);
        expect(savedProduct.updatedAt).toBeInstanceOf(Date);
    });

    it("should update the updatedAt timestamp when a product is modified", async () => {
        // Arrange - Create and save a new product instance with valid data
        const product = new productModel(validProductData);
        const savedProduct = await product.save();
        const originalUpdatedAt = savedProduct.updatedAt;

        // Act - Wait for a short time to ensure a different timestamp, then modify the product and save it again
        await new Promise((resolve) => setTimeout(resolve, 1000));
        savedProduct.price = 15.99;
        const updatedProduct = await savedProduct.save();

        // Assert - Check if the updatedAt timestamp has been updated to a later time than the original
        expect(updatedProduct.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
});

