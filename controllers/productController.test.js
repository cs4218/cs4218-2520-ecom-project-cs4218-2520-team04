import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
import orderModel from "../models/orderModel.js";
import slugify from "slugify";
import fs from "fs";
import * as braintree from "braintree";
import {
  createProductController,
  deleteProductController,
  updateProductController,
  getProductController,
  getSingleProductController,
  productPhotoController,
  productFiltersController,
  productCountController,
  productListController,
  searchProductController,
  relatedProductController,
  productCategoryController,
  braintreePaymentController,
  braintreeTokenController,
} from "./productController.js";

// Mock dependencies
jest.mock("../models/productModel.js");
jest.mock("../models/categoryModel.js");
jest.mock("../models/orderModel.js");
jest.mock("slugify");
jest.mock("fs");
jest.mock("braintree", () => {
  const gateway = {
    clientToken: { generate: jest.fn() },
    transaction: { sale: jest.fn() },
  };
  return {
    BraintreeGateway: jest.fn(() => gateway),
    Environment: { Sandbox: "sandbox" },
    __mockGateway: gateway,
  };
});

// Helpers
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const validFields = () => ({
  name: "Test Product",
  description: "A test product",
  price: "29.99",
  category: "cat123",
  quantity: "10",
  shipping: true,
});

const validPhoto = () => ({
  size: 500000,
  path: "/tmp/photo.jpg",
  type: "image/jpeg",
});

const mockReq = (overrides = {}) => ({
  fields: validFields(),
  files: { photo: validPhoto() },
  params: {},
  ...overrides,
});

const getMockBraintreeGateway = () => braintree.__mockGateway;

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Tan Wei Lian, A0269750U
describe("createProductController", () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
  });

  // validate name
  test("should return 400 when name is missing", async () => {
    // Arrange
    const fields = validFields();
    delete fields.name;
    const req = mockReq({ fields });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Name is Required",
    });
  });

  test("should return 400 when name is whitespace only", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), name: "   " } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Name is Required",
    });
  });

  // validate description
  test("should return 400 when description is missing", async () => {
    // Arrange
    const fields = validFields();
    delete fields.description;
    const req = mockReq({ fields });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Description is Required",
    });
  });

  test("should return 400 when description is whitespace only", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), description: "  " } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Description is Required",
    });
  });

  // validate price
  test("should return 400 when price is missing", async () => {
    // Arrange
    const fields = validFields();
    delete fields.price;
    const req = mockReq({ fields });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Price is Required and must be a non-negative number",
    });
  });

  test("should return 400 when price is not a number", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), price: "abc" } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Price is Required and must be a non-negative number",
    });
  });

  test("should return 400 when price is an empty string", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), price: "" } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Price is Required and must be a non-negative number",
    });
  });

  test("should return 400 when price is negative", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), price: "-10" } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Price is Required and must be a non-negative number",
    });
  });

  test("should return 400 when price is -1 (boundary below 0)", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), price: -1 } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Price is Required and must be a non-negative number",
    });
  });

  test("should accept price of 0 (free product)", async () => {
    // Arrange — price is 0, should pass validation and create product successfully
    const req = mockReq({ fields: { ...validFields(), price: 0 } });
    categoryModel.findById.mockResolvedValue({ _id: "cat123" });
    slugify.mockReturnValue("test-product");
    fs.readFileSync.mockReturnValue(Buffer.from("photo-data"));

    const saveMock = jest.fn().mockResolvedValue(true);
    productModel.mockImplementation(() => ({ save: saveMock, photo: {} }));

    // Act
    await createProductController(req, res);

    // Assert — price 0 accepted, product created
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Product Created Successfully",
      }),
    );
  });

  test("should accept price of 1 (boundary above 0)", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), price: 1 } });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await createProductController(req, res);

    // Assert — passes price validation, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  // validate category
  test("should return 400 when category is missing", async () => {
    // Arrange
    const fields = validFields();
    delete fields.category;
    const req = mockReq({ fields });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category is Required",
    });
  });

  // validate quantity
  test("should return 400 when quantity is missing", async () => {
    // Arrange
    const fields = validFields();
    delete fields.quantity;
    const req = mockReq({ fields });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Quantity is Required and must be a non-negative number",
    });
  });

  test("should return 400 when quantity is not a number", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), quantity: "xyz" } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Quantity is Required and must be a non-negative number",
    });
  });

  test("should return 400 when quantity is negative", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), quantity: -5 } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Quantity is Required and must be a non-negative number",
    });
  });

  test("should return 400 when quantity is -1 (boundary below 0)", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), quantity: -1 } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Quantity is Required and must be a non-negative number",
    });
  });

  test("should accept quantity of 0 (out of stock)", async () => {
    // Arrange — quantity is 0, should pass validation and create product successfully
    const req = mockReq({ fields: { ...validFields(), quantity: 0 } });
    categoryModel.findById.mockResolvedValue({ _id: "cat123" });
    slugify.mockReturnValue("test-product");
    fs.readFileSync.mockReturnValue(Buffer.from("photo-data"));

    const saveMock = jest.fn().mockResolvedValue(true);
    productModel.mockImplementation(() => ({ save: saveMock, photo: {} }));

    // Act
    await createProductController(req, res);

    // Assert — quantity 0 accepted, product created
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Product Created Successfully",
      }),
    );
  });

  test("should accept quantity of 1 (boundary above 0)", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), quantity: 1 } });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await createProductController(req, res);

    // Assert — passes quantity validation, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  // validate photo
  test("should return 400 when photo is missing", async () => {
    // Arrange
    const req = mockReq({ files: {} });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Photo is Required",
    });
  });

  test("should return 400 when photo exceeds 1MB", async () => {
    // Arrange
    const req = mockReq({
      files: {
        photo: { size: 1000001, path: "/tmp/big.jpg", type: "image/jpeg" },
      },
    });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Photo should be less than 1mb",
    });
  });

  test("should accept photo of exactly 1000000 bytes (boundary at limit)", async () => {
    // Arrange — size === 1000000 passes because check is > not >=
    const req = mockReq({
      files: {
        photo: { size: 1000000, path: "/tmp/photo.jpg", type: "image/jpeg" },
      },
    });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await createProductController(req, res);

    // Assert — passes photo validation, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  test("should accept photo of 999999 bytes (boundary below limit)", async () => {
    // Arrange
    const req = mockReq({
      files: {
        photo: { size: 999999, path: "/tmp/photo.jpg", type: "image/jpeg" },
      },
    });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await createProductController(req, res);

    // Assert — passes photo validation, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  // validate category
  test("should return 404 when category does not exist in DB", async () => {
    // Arrange
    const req = mockReq();
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await createProductController(req, res);

    // Assert
    expect(categoryModel.findById).toHaveBeenCalledWith("cat123");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  // happy path
  test("should create product and return 201", async () => {
    // Arrange
    const req = mockReq();
    categoryModel.findById.mockResolvedValue({ _id: "cat123" });
    slugify.mockReturnValue("test-product");
    fs.readFileSync.mockReturnValue(Buffer.from("photo-data"));

    const saveMock = jest.fn().mockResolvedValue(true);
    const productInstance = { save: saveMock, photo: {} };
    productModel.mockImplementation(() => productInstance);

    // Act
    await createProductController(req, res);

    // Assert
    expect(slugify).toHaveBeenCalledWith("Test Product");
    expect(productModel).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test Product", slug: "test-product" }),
    );
    expect(fs.readFileSync).toHaveBeenCalledWith("/tmp/photo.jpg");
    expect(productInstance.photo.data).toEqual(Buffer.from("photo-data"));
    expect(productInstance.photo.contentType).toBe("image/jpeg");
    expect(saveMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Product Created Successfully",
      }),
    );
  });

  test("should trim name and description before saving", async () => {
    // Arrange — both have surrounding whitespace
    const req = mockReq({
      fields: {
        ...validFields(),
        name: "  Padded Name  ",
        description: "  Padded Desc  ",
      },
    });
    categoryModel.findById.mockResolvedValue({ _id: "cat123" });
    slugify.mockReturnValue("padded-name");
    fs.readFileSync.mockReturnValue(Buffer.from("data"));

    const saveMock = jest.fn().mockResolvedValue(true);
    productModel.mockImplementation(() => ({ save: saveMock, photo: {} }));

    // Act
    await createProductController(req, res);

    // Assert — trimmed values used
    expect(slugify).toHaveBeenCalledWith("Padded Name");
    expect(productModel).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Padded Name",
        description: "Padded Desc",
        slug: "padded-name",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  // error paths
  test("should return 500 when categoryModel.findById throws", async () => {
    // Arrange
    const req = mockReq();
    const dbError = new Error("DB error");
    categoryModel.findById.mockRejectedValue(dbError);

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      error: dbError,
      message: "Error in creating product",
    });
  });

  test("should return 500 when save throws", async () => {
    // Arrange
    const req = mockReq();
    categoryModel.findById.mockResolvedValue({ _id: "cat123" });
    slugify.mockReturnValue("test-product");
    fs.readFileSync.mockReturnValue(Buffer.from("data"));

    const saveError = new Error("Save failed");
    productModel.mockImplementation(() => ({
      save: jest.fn().mockRejectedValue(saveError),
      photo: {},
    }));

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      error: saveError,
      message: "Error in creating product",
    });
  });
});

// Tan Wei Lian, A0269750U
describe("deleteProductController", () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
  });

  test("should delete product and return 200", async () => {
    // Arrange
    const req = mockReq({ params: { pid: "p123" } });
    orderModel.findOne.mockResolvedValue(null);
    productModel.findByIdAndDelete.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "p123" }),
    });

    // Act
    await deleteProductController(req, res);

    // Assert
    expect(orderModel.findOne).toHaveBeenCalledWith({ products: "p123" });
    expect(productModel.findByIdAndDelete).toHaveBeenCalledWith("p123");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Product Deleted successfully",
    });
  });

  test("should return 400 when product is associated with an order", async () => {
    // Arrange
    const req = mockReq({ params: { pid: "p123" } });
    orderModel.findOne.mockResolvedValue({ _id: "order1", products: ["p123"] });

    // Act
    await deleteProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Cannot delete product associated with orders",
    });
    expect(productModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test("should return 404 when product does not exist", async () => {
    // Arrange
    const req = mockReq({ params: { pid: "missing" } });
    orderModel.findOne.mockResolvedValue(null);
    productModel.findByIdAndDelete.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    // Act
    await deleteProductController(req, res);

    // Assert
    expect(productModel.findByIdAndDelete).toHaveBeenCalledWith("missing");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Product not found",
    });
  });

  test("should return 500 when orderModel.findOne throws", async () => {
    // Arrange
    const req = mockReq({ params: { pid: "p123" } });
    const dbError = new Error("Order lookup failed");
    orderModel.findOne.mockRejectedValue(dbError);

    // Act
    await deleteProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Error while deleting product",
      error: dbError,
    });
    expect(productModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test("should return 500 when findByIdAndDelete throws", async () => {
    // Arrange
    const req = mockReq({ params: { pid: "p123" } });
    orderModel.findOne.mockResolvedValue(null);
    productModel.findByIdAndDelete.mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error("Delete failed")),
    });

    // Act
    await deleteProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Error while deleting product",
      }),
    );
  });
});

// Tan Wei Lian, A0269750U
describe("updateProductController", () => {
  let res;

  // Helper: builds a mock product document returned by findByIdAndUpdate
  const mockUpdatedProduct = () => ({
    save: jest.fn().mockResolvedValue(true),
    photo: {},
  });

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
  });

  // --- Validation (mirrors create, except photo is optional) ---

  test("should return 400 when name is missing", async () => {
    // Arrange
    const fields = validFields();
    delete fields.name;
    const req = mockReq({ fields, params: { pid: "p1" } });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Name is Required",
    });
  });

  test("should return 400 when name is whitespace only", async () => {
    // Arrange
    const req = mockReq({
      fields: { ...validFields(), name: "  " },
      params: { pid: "p1" },
    });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Name is Required",
    });
  });

  test("should return 400 when description is missing", async () => {
    // Arrange
    const fields = validFields();
    delete fields.description;
    const req = mockReq({ fields, params: { pid: "p1" } });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Description is Required",
    });
  });

  test("should return 400 when description is whitespace only", async () => {
    // Arrange
    const req = mockReq({
      fields: { ...validFields(), description: "   " },
      params: { pid: "p1" },
    });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Description is Required",
    });
  });

  test("should return 400 when price is missing", async () => {
    // Arrange
    const fields = validFields();
    delete fields.price;
    const req = mockReq({ fields, params: { pid: "p1" } });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Price is Required and must be a non-negative number",
    });
  });

  test("should return 400 when price is not a number", async () => {
    // Arrange
    const req = mockReq({
      fields: { ...validFields(), price: "abc" },
      params: { pid: "p1" },
    });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Price is Required and must be a non-negative number",
    });
  });

  test("should return 400 when price is an empty string", async () => {
    // Arrange
    const req = mockReq({
      fields: { ...validFields(), price: "" },
      params: { pid: "p1" },
    });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Price is Required and must be a non-negative number",
    });
  });

  test("should return 400 when price is negative", async () => {
    // Arrange
    const req = mockReq({
      fields: { ...validFields(), price: -10 },
      params: { pid: "p1" },
    });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Price is Required and must be a non-negative number",
    });
  });

  test("should return 400 when price is -1 (boundary below 0)", async () => {
    // Arrange
    const req = mockReq({
      fields: { ...validFields(), price: -1 },
      params: { pid: "p1" },
    });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Price is Required and must be a non-negative number",
    });
  });

  test("should accept price of 0", async () => {
    // Arrange — price 0, passes validation, reaches category check
    const req = mockReq({
      fields: { ...validFields(), price: 0 },
      params: { pid: "p1" },
      files: {},
    });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await updateProductController(req, res);

    // Assert — passes price check, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  test("should accept price of 1 (boundary above 0)", async () => {
    // Arrange
    const req = mockReq({
      fields: { ...validFields(), price: 1 },
      params: { pid: "p1" },
      files: {},
    });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await updateProductController(req, res);

    // Assert — passes price validation, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  test("should return 400 when category is missing", async () => {
    // Arrange
    const fields = validFields();
    delete fields.category;
    const req = mockReq({ fields, params: { pid: "p1" } });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category is Required",
    });
  });

  test("should return 400 when quantity is missing", async () => {
    // Arrange
    const fields = validFields();
    delete fields.quantity;
    const req = mockReq({ fields, params: { pid: "p1" } });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Quantity is Required and must be a non-negative number",
    });
  });

  test("should return 400 when quantity is not a number", async () => {
    // Arrange
    const req = mockReq({
      fields: { ...validFields(), quantity: "xyz" },
      params: { pid: "p1" },
    });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Quantity is Required and must be a non-negative number",
    });
  });

  test("should return 400 when quantity is negative", async () => {
    // Arrange
    const req = mockReq({
      fields: { ...validFields(), quantity: -3 },
      params: { pid: "p1" },
    });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Quantity is Required and must be a non-negative number",
    });
  });

  test("should return 400 when quantity is -1 (boundary below 0)", async () => {
    // Arrange
    const req = mockReq({
      fields: { ...validFields(), quantity: -1 },
      params: { pid: "p1" },
    });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Quantity is Required and must be a non-negative number",
    });
  });

  test("should accept quantity of 0", async () => {
    // Arrange — quantity 0, passes validation, reaches category check
    const req = mockReq({
      fields: { ...validFields(), quantity: 0 },
      params: { pid: "p1" },
      files: {},
    });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await updateProductController(req, res);

    // Assert — passes quantity check, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  test("should accept quantity of 1 (boundary above 0)", async () => {
    // Arrange
    const req = mockReq({
      fields: { ...validFields(), quantity: 1 },
      params: { pid: "p1" },
      files: {},
    });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await updateProductController(req, res);

    // Assert — passes quantity validation, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  test("should return 400 when photo exceeds 1MB", async () => {
    // Arrange
    const req = mockReq({
      files: {
        photo: { size: 1000001, path: "/tmp/big.jpg", type: "image/jpeg" },
      },
      params: { pid: "p1" },
    });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Photo should be less than 1mb",
    });
  });

  test("should accept photo of exactly 1000000 bytes (boundary at limit)", async () => {
    // Arrange — size === 1000000 passes because check is > not >=
    const req = mockReq({
      files: {
        photo: { size: 1000000, path: "/tmp/photo.jpg", type: "image/jpeg" },
      },
      params: { pid: "p1" },
    });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await updateProductController(req, res);

    // Assert — passes photo validation, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  test("should accept photo of 999999 bytes (boundary below limit)", async () => {
    // Arrange
    const req = mockReq({
      files: {
        photo: { size: 999999, path: "/tmp/photo.jpg", type: "image/jpeg" },
      },
      params: { pid: "p1" },
    });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await updateProductController(req, res);

    // Assert — passes photo validation, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  // --- Category & product lookup ---

  test("should return 404 when category does not exist", async () => {
    // Arrange
    const req = mockReq({ params: { pid: "p1" }, files: {} });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await updateProductController(req, res);

    // Assert
    expect(categoryModel.findById).toHaveBeenCalledWith("cat123");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  test("should return 404 when product does not exist", async () => {
    // Arrange
    const req = mockReq({ params: { pid: "missing" }, files: {} });
    categoryModel.findById.mockResolvedValue({ _id: "cat123" });
    slugify.mockReturnValue("test-product");
    productModel.findByIdAndUpdate.mockResolvedValue(null);

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Product not found",
    });
  });

  // happy paths
  test("should update product without photo and return 200", async () => {
    // Arrange — no photo in files
    const req = mockReq({ params: { pid: "p1" }, files: {} });
    categoryModel.findById.mockResolvedValue({ _id: "cat123" });
    slugify.mockReturnValue("test-product");

    const updatedProduct = mockUpdatedProduct();
    productModel.findByIdAndUpdate.mockResolvedValue(updatedProduct);

    // Act
    await updateProductController(req, res);

    // Assert
    expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ name: "Test Product", slug: "test-product" }),
      { new: true },
    );
    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(updatedProduct.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Product Updated Successfully",
      }),
    );
  });

  test("should update product with photo and return 200", async () => {
    // Arrange
    const req = mockReq({ params: { pid: "p1" } });
    categoryModel.findById.mockResolvedValue({ _id: "cat123" });
    slugify.mockReturnValue("test-product");
    fs.readFileSync.mockReturnValue(Buffer.from("new-photo"));

    const updatedProduct = mockUpdatedProduct();
    productModel.findByIdAndUpdate.mockResolvedValue(updatedProduct);

    // Act
    await updateProductController(req, res);

    // Assert
    expect(fs.readFileSync).toHaveBeenCalledWith("/tmp/photo.jpg");
    expect(updatedProduct.photo.data).toEqual(Buffer.from("new-photo"));
    expect(updatedProduct.photo.contentType).toBe("image/jpeg");
    expect(updatedProduct.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should trim name and description before updating", async () => {
    // Arrange
    const req = mockReq({
      fields: {
        ...validFields(),
        name: "  Padded  ",
        description: "  Padded Desc  ",
      },
      params: { pid: "p1" },
      files: {},
    });
    categoryModel.findById.mockResolvedValue({ _id: "cat123" });
    slugify.mockReturnValue("padded");
    productModel.findByIdAndUpdate.mockResolvedValue(mockUpdatedProduct());

    // Act
    await updateProductController(req, res);

    // Assert
    expect(slugify).toHaveBeenCalledWith("Padded");
    expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        name: "Padded",
        description: "Padded Desc",
        slug: "padded",
      }),
      { new: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // error paths
  test("should return 500 when findByIdAndUpdate throws", async () => {
    // Arrange
    const req = mockReq({ params: { pid: "p1" }, files: {} });
    categoryModel.findById.mockResolvedValue({ _id: "cat123" });
    slugify.mockReturnValue("test-product");
    const dbError = new Error("Update failed");
    productModel.findByIdAndUpdate.mockRejectedValue(dbError);

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      error: dbError,
      message: "Error in Update product",
    });
  });

  test("should return 500 when save throws after update", async () => {
    // Arrange
    const req = mockReq({ params: { pid: "p1" }, files: {} });
    categoryModel.findById.mockResolvedValue({ _id: "cat123" });
    slugify.mockReturnValue("test-product");

    const saveError = new Error("Save failed");
    productModel.findByIdAndUpdate.mockResolvedValue({
      save: jest.fn().mockRejectedValue(saveError),
      photo: {},
    });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      error: saveError,
      message: "Error in Update product",
    });
  });
});

// Teo Kai Xiang, A0272558U
// Test cases generated by GPT-5.3-Codex via planning mode. Reviewed and edited by me afterwards
describe("braintreeTokenController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockReq();
    res = mockRes();
  });

  describe("Happy Path Tests - when everything works as expected, the controller", () => {
    test("should return generated braintree client token response", async () => {
      // Arrange
      const responseObj = { clientToken: "token-123" };
      getMockBraintreeGateway().clientToken.generate.mockImplementationOnce(
        (payload, callback) => callback(null, responseObj),
      );

      // Act
      await braintreeTokenController(req, res);

      // Assert
      expect(
        getMockBraintreeGateway().clientToken.generate,
      ).toHaveBeenCalledWith({}, expect.any(Function));
      expect(res.send).toHaveBeenCalledWith(responseObj);
      expect(res.status).not.toHaveBeenCalledWith(500);
    });
  });

  describe("Unhappy Path Tests - when there are issues, the controller", () => {
    test("should return 500 when braintree generate returns an error", async () => {
      // Arrange
      const errObj = new Error("token generation failed");
      getMockBraintreeGateway().clientToken.generate.mockImplementationOnce(
        (payload, callback) => callback(errObj, null),
      );

      // Act
      await braintreeTokenController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(errObj);
    });

    test("should log when generate throws synchronously", async () => {
      // Arrange
      getMockBraintreeGateway().clientToken.generate.mockImplementationOnce(
        () => {
          throw new Error("sync token throw");
        },
      );

      // Act
      await braintreeTokenController(req, res);

      // Assert
      expect(console.log).toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});

// Teo Kai Xiang, A0272558U
// Test cases generated by GPT-5.3-Codex via planning mode. Reviewed and edited by me afterwards
describe("braintreePaymentController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
  });

  describe("Happy Path Tests - when everything works as expected, the controller", () => {
    test("should process payment, save order, and return ok true", async () => {
      // Arrange
      const cart = [
        { _id: "p1", price: 10 },
        { _id: "p2", price: 15 },
      ];
      const nonce = "nonce-123";
      const buyerId = "buyer123";
      const resultObj = { transaction: { id: "txn-1" } };
      const saveMock = jest.fn().mockResolvedValue({ _id: "order1" });
      orderModel.mockImplementation(() => ({ save: saveMock }));
      req = mockReq({
        body: { nonce, cart },
        user: { _id: buyerId },
      });
      getMockBraintreeGateway().transaction.sale.mockImplementationOnce(
        (payload, callback) => callback(null, resultObj),
      );

      // Act
      await braintreePaymentController(req, res);

      // Assert
      expect(getMockBraintreeGateway().transaction.sale).toHaveBeenCalledWith(
        {
          amount: 25,
          paymentMethodNonce: nonce,
          options: { submitForSettlement: true },
        },
        expect.any(Function),
      );
      expect(orderModel).toHaveBeenCalledWith({
        products: cart,
        payment: resultObj,
        buyer: buyerId,
      });
      expect(saveMock).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("should compute total amount correctly for multi-item cart", async () => {
      // Arrange
      const cart = [
        { _id: "p1", price: 29.99 },
        { _id: "p2", price: 50 },
        { _id: "p3", price: 20.01 },
      ];
      const saveMock = jest.fn().mockResolvedValue({ _id: "order2" });
      orderModel.mockImplementation(() => ({ save: saveMock }));
      req = mockReq({
        body: { nonce: "nonce-456", cart },
        user: { _id: "buyer456" },
      });
      getMockBraintreeGateway().transaction.sale.mockImplementationOnce(
        (payload, callback) => callback(null, { transaction: { id: "txn-2" } }),
      );

      // Act
      await braintreePaymentController(req, res);

      // Assert
      expect(getMockBraintreeGateway().transaction.sale).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100 }),
        expect.any(Function),
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe("Unhappy Path Tests - when there are issues, the controller", () => {
    test("should return 500 when sale callback returns error and no result", async () => {
      // Arrange
      const errorObj = new Error("payment failed");
      req = mockReq({
        body: { nonce: "nonce-fail", cart: [{ _id: "p1", price: 10 }] },
        user: { _id: "buyer-fail" },
      });
      getMockBraintreeGateway().transaction.sale.mockImplementationOnce(
        (payload, callback) => callback(errorObj, null),
      );

      // Act
      await braintreePaymentController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(errorObj);
      expect(orderModel).not.toHaveBeenCalled();
    });

    test("should log when transaction.sale throws synchronously", async () => {
      // Arrange
      req = mockReq({
        body: { nonce: "nonce-sync-throw", cart: [{ _id: "p1", price: 10 }] },
        user: { _id: "buyer-sync" },
      });
      getMockBraintreeGateway().transaction.sale.mockImplementationOnce(() => {
        throw new Error("sync sale throw");
      });

      // Act
      await braintreePaymentController(req, res);

      // Assert
      expect(console.log).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});

// Teo Kai Xiang, A0272558U
// Test cases generated by GPT-5.3-Codex via planning mode. Reviewed and edited by me afterwards
describe("braintreeTokenController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockReq();
    res = mockRes();
  });

  describe("Happy Path Tests - when everything works as expected, the controller", () => {
    test("should return generated braintree client token response", async () => {
      // Arrange
      const responseObj = { clientToken: "token-123" };
      getMockBraintreeGateway().clientToken.generate.mockImplementationOnce(
        (payload, callback) => callback(null, responseObj),
      );

      // Act
      await braintreeTokenController(req, res);

      // Assert
      expect(
        getMockBraintreeGateway().clientToken.generate,
      ).toHaveBeenCalledWith({}, expect.any(Function));
      expect(res.send).toHaveBeenCalledWith(responseObj);
      expect(res.status).not.toHaveBeenCalledWith(500);
    });
  });

  describe("Unhappy Path Tests - when there are issues, the controller", () => {
    test("should return 500 when braintree generate returns an error", async () => {
      // Arrange
      const errObj = new Error("token generation failed");
      getMockBraintreeGateway().clientToken.generate.mockImplementationOnce(
        (payload, callback) => callback(errObj, null),
      );

      // Act
      await braintreeTokenController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(errObj);
    });

    test("should log when generate throws synchronously", async () => {
      // Arrange
      getMockBraintreeGateway().clientToken.generate.mockImplementationOnce(
        () => {
          throw new Error("sync token throw");
        },
      );

      // Act
      await braintreeTokenController(req, res);

      // Assert
      expect(console.log).toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});

// Teo Kai Xiang, A0272558U
// Test cases generated by GPT-5.3-Codex via planning mode. Reviewed and edited by me afterwards
describe("braintreePaymentController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
  });

  describe("Happy Path Tests - when everything works as expected, the controller", () => {
    test("should process payment, save order, and return ok true", async () => {
      // Arrange
      const cart = [
        { _id: "p1", price: 10 },
        { _id: "p2", price: 15 },
      ];
      const nonce = "nonce-123";
      const buyerId = "buyer123";
      const resultObj = { transaction: { id: "txn-1" } };
      const saveMock = jest.fn().mockResolvedValue({ _id: "order1" });
      orderModel.mockImplementation(() => ({ save: saveMock }));
      req = mockReq({
        body: { nonce, cart },
        user: { _id: buyerId },
      });
      getMockBraintreeGateway().transaction.sale.mockImplementationOnce(
        (payload, callback) => callback(null, resultObj),
      );

      // Act
      await braintreePaymentController(req, res);

      // Assert
      expect(getMockBraintreeGateway().transaction.sale).toHaveBeenCalledWith(
        {
          amount: 25,
          paymentMethodNonce: nonce,
          options: { submitForSettlement: true },
        },
        expect.any(Function),
      );
      expect(orderModel).toHaveBeenCalledWith({
        products: cart,
        payment: resultObj,
        buyer: buyerId,
      });
      expect(saveMock).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("should compute total amount correctly for multi-item cart", async () => {
      // Arrange
      const cart = [
        { _id: "p1", price: 29.99 },
        { _id: "p2", price: 50 },
        { _id: "p3", price: 20.01 },
      ];
      const saveMock = jest.fn().mockResolvedValue({ _id: "order2" });
      orderModel.mockImplementation(() => ({ save: saveMock }));
      req = mockReq({
        body: { nonce: "nonce-456", cart },
        user: { _id: "buyer456" },
      });
      getMockBraintreeGateway().transaction.sale.mockImplementationOnce(
        (payload, callback) => callback(null, { transaction: { id: "txn-2" } }),
      );

      // Act
      await braintreePaymentController(req, res);

      // Assert
      expect(getMockBraintreeGateway().transaction.sale).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100 }),
        expect.any(Function),
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe("Unhappy Path Tests - when there are issues, the controller", () => {
    test("should return 500 when sale callback returns error and no result", async () => {
      // Arrange
      const errorObj = new Error("payment failed");
      req = mockReq({
        body: { nonce: "nonce-fail", cart: [{ _id: "p1", price: 10 }] },
        user: { _id: "buyer-fail" },
      });
      getMockBraintreeGateway().transaction.sale.mockImplementationOnce(
        (payload, callback) => callback(errorObj, null),
      );

      // Act
      await braintreePaymentController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(errorObj);
      expect(orderModel).not.toHaveBeenCalled();
    });

    test("should log when transaction.sale throws synchronously", async () => {
      // Arrange
      req = mockReq({
        body: { nonce: "nonce-sync-throw", cart: [{ _id: "p1", price: 10 }] },
        user: { _id: "buyer-sync" },
      });
      getMockBraintreeGateway().transaction.sale.mockImplementationOnce(() => {
        throw new Error("sync sale throw");
      });

      // Act
      await braintreePaymentController(req, res);

      // Assert
      expect(console.log).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});

// Yeo Yi Wen, A0273575U
describe("getProductController", () => {
  // Tests setup
  let req, res;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // Happy path
  test("should return products successfully", async () => {
    // Arrange
    const mockProducts = [
      { _id: "1", name: "Product 1", category: { _id: "c1", name: "Cat1" } },
      { _id: "2", name: "Product 2", category: { _id: "c2", name: "Cat2" } },
    ];

    productModel.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockProducts),
          }),
        }),
      }),
    });

    // Act
    await getProductController(req, res);

    // Assert
    expect(
      productModel.find().populate().select().limit().sort,
    ).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      countTotal: 2,
      message: "All Products",
      products: mockProducts,
    });
  });

  test("should return empty array when no products", async () => {
    // Arrange
    productModel.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    // Act
    await getProductController(req, res);

    // Assert
    expect(
      productModel.find().populate().select().limit().sort,
    ).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      countTotal: 0,
      message: "All Products",
      products: [],
    });
  });

  test("should handle errors gracefully", async () => {
    // Arrange
    const error = new Error("Error in getting products");

    productModel.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockRejectedValue(error),
          }),
        }),
      }),
    });

    // Act
    await getProductController(req, res);

    // Assert
    expect(
      productModel.find().populate().select().limit().sort,
    ).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Error in getting products",
      error: error.message,
    });
  });
});

// Yeo Yi Wen, A0273575U
describe("getSingleProductController", () => {
  // Test setups
  let req, res;

  beforeEach(() => {
    req = {
      params: {
        slug: "test-product",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // Happy path
  test("should return status 200 product when found", async () => {
    // Arrange
    const mockProduct = { name: "Test", slug: "test-product" };
    productModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockProduct),
      }),
    });

    // Act
    await getSingleProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Single Product Fetched",
      product: mockProduct,
    });
  });

  test("should return status 404 when product does not exist", async () => {
    // Arrange
    productModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      }),
    });

    // Act
    await getSingleProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Product not found",
    });
  });

  test("should handle errors and return status 500", async () => {
    // Arrange
    const error = new Error("Error: Status 500");
    productModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockRejectedValue(error),
      }),
    });

    // Act
    await getSingleProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Error while getting single product",
      error: error,
    });
  });
});

// Yeo Yi Wen, A0273575U
describe("productPhotoController", () => {
  let req, res;

  beforeEach(() => {
    req = { params: { pid: "123" } };
    res = {
      set: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // Happy path
  test("should return product photo successfully if photo exists", async () => {
    // Arrange
    const mockProduct = {
      photo: {
        data: Buffer.from("fake-image-data"),
        contentType: "image/jpeg",
      },
    };
    productModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockProduct),
    });

    // Act
    await productPhotoController(req, res);

    // Assert
    expect(productModel.findById).toHaveBeenCalledWith("123");
    expect(res.set).toHaveBeenCalledWith("Content-type", "image/jpeg");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(mockProduct.photo.data);
  });

  // No errors should occur
  test("should do nothing when product has no photo data", async () => {
    // Arrange
    const mockProduct = {
      photo: {
        data: null,
        contentType: "image/png",
      },
    };
    productModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockProduct),
    });

    // Act
    await productPhotoController(req, res);

    // Assert
    expect(res.set).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  test("should handle error if product does not exist", async () => {
    // Arrange
    const error = new Error("Product does not exist");
    productModel.findById.mockReturnValue({
      select: jest.fn().mockRejectedValue(error),
    });

    // Act
    await productPhotoController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Error while getting photo",
      error: error,
    });
  });
});

// Yeo Yi Wen, A0273575U
describe("productFiltersController", () => {
  // Test setups
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        checked: [],
        radio: [],
        page: 1,
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // Happy path - single category filter
  test("products should filtered successfully by 1 category only", async () => {
    // Arrange
    req.body.checked = ["cat1"];
    req.body.radio = [];

    const mockAllProducts = [
      { _id: "1", name: "Product 1", category: "cat1" },
      { _id: "2", name: "Product 2", category: "cat2" },
    ];

    const filteredProducts = mockAllProducts.filter((p) =>
      req.body.checked.includes(p.category),
    );
    const sort = jest.fn().mockResolvedValue(filteredProducts);
    const limit = jest.fn().mockReturnValue({ sort });
    const skip = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ skip });
    productModel.countDocuments.mockResolvedValue(filteredProducts.length);
    productModel.find.mockReturnValue({ select });

    // Act
    await productFiltersController(req, res);

    // Assert
    expect(productModel.find).toHaveBeenCalledWith({
      category: ["cat1"],
    });
    expect(productModel.countDocuments).toHaveBeenCalledWith({
      category: ["cat1"],
    });
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: [{ _id: "1", name: "Product 1", category: "cat1" }],
      total: 1,
    });
  });

  // Happy path - multiple category filter
  test("products should filtered successfully by multiple categories only", async () => {
    // Arrange
    req.body.checked = ["cat1", "cat2"];
    req.body.radio = [];

    const mockAllProducts = [
      { _id: "1", name: "Product 1", category: "cat1" },
      { _id: "2", name: "Product 2", category: "cat2" },
      { _id: "3", name: "Product 3", category: "cat3" },
    ];

    const filteredProducts = mockAllProducts.filter((p) =>
      req.body.checked.includes(p.category),
    );
    const sort = jest.fn().mockResolvedValue(filteredProducts);
    const limit = jest.fn().mockReturnValue({ sort });
    const skip = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ skip });
    productModel.countDocuments.mockResolvedValue(filteredProducts.length);
    productModel.find.mockReturnValue({ select });

    // Act
    await productFiltersController(req, res);

    // Assert
    expect(productModel.find).toHaveBeenCalledWith({
      category: ["cat1", "cat2"],
    });
    expect(productModel.countDocuments).toHaveBeenCalledWith({
      category: ["cat1", "cat2"],
    });
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: [
        { _id: "1", name: "Product 1", category: "cat1" },
        { _id: "2", name: "Product 2", category: "cat2" },
      ],
      total: 2,
    });
  });

  // Happy path - price filter
  test("products should be filtered by price range", async () => {
    // Arrange
    req.body.radio = [100, 500];

    const allProducts = [
      { _id: "1", price: 200 },
      { _id: "2", price: 50 }, // will be filtered out
      { _id: "3", price: 300 },
      { _id: "4", price: 600 }, // will be filtered out
    ];

    const filteredProducts = allProducts.filter(
      (p) => p.price >= req.body.radio[0] && p.price <= req.body.radio[1],
    );
    const sort = jest.fn().mockResolvedValue(filteredProducts);
    const limit = jest.fn().mockReturnValue({ sort });
    const skip = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ skip });
    productModel.countDocuments.mockResolvedValue(filteredProducts.length);
    productModel.find.mockReturnValue({ select });

    // Act
    await productFiltersController(req, res);

    // Assert
    expect(productModel.find).toHaveBeenCalledWith({
      price: { $gte: 100, $lte: 500 },
    });
    expect(productModel.countDocuments).toHaveBeenCalledWith({
      price: { $gte: 100, $lte: 500 },
    });
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: [
        { _id: "1", price: 200 },
        { _id: "3", price: 300 },
      ],
      total: 2,
    });
  });

  // Happy path - category + price filter
  test("products should filtered by categories and price range", async () => {
    // Arrange
    req.body.checked = ["cat1", "cat2"];
    req.body.radio = [100, 500];

    // All products in database (before filtering)
    const allProducts = [
      // Included products
      { _id: "1", name: "Product 1", category: "cat1", price: 200 },
      { _id: "3", name: "Product 3", category: "cat2", price: 300 },
      { _id: "5", name: "Product 5", category: "cat1", price: 450 },

      // Excluded products
      { _id: "2", name: "Product 2", category: "cat2", price: 50 }, // Price too low
      { _id: "4", name: "Product 4", category: "cat3", price: 250 }, // Wrong category
      { _id: "6", name: "Product 6", category: "cat1", price: 600 }, // Price too high
      { _id: "7", name: "Product 7", category: "cat3", price: 700 }, // Wrong category + wrong price
    ];

    const filteredProducts = allProducts.filter(
      (p) =>
        req.body.checked.includes(p.category) &&
        p.price >= req.body.radio[0] &&
        p.price <= req.body.radio[1],
    );
    const sort = jest.fn().mockResolvedValue(filteredProducts);
    const limit = jest.fn().mockReturnValue({ sort });
    const skip = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ skip });
    productModel.countDocuments.mockResolvedValue(filteredProducts.length);
    productModel.find.mockReturnValue({ select });

    // Act
    await productFiltersController(req, res);

    // Assert
    expect(productModel.find).toHaveBeenCalledWith({
      category: ["cat1", "cat2"],
      price: { $gte: 100, $lte: 500 },
    });
    expect(productModel.countDocuments).toHaveBeenCalledWith({
      category: ["cat1", "cat2"],
      price: { $gte: 100, $lte: 500 },
    });
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: [
        { _id: "1", name: "Product 1", category: "cat1", price: 200 },
        { _id: "3", name: "Product 3", category: "cat2", price: 300 },
        { _id: "5", name: "Product 5", category: "cat1", price: 450 },
      ],
      total: 3,
    });
  });

  // No filters
  test("should return all products with no filters", async () => {
    const mockProducts = [{ _id: "1" }, { _id: "2" }];
    const sort = jest.fn().mockResolvedValue(mockProducts);
    const limit = jest.fn().mockReturnValue({ sort });
    const skip = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ skip });
    productModel.countDocuments.mockResolvedValue(mockProducts.length);
    productModel.find.mockReturnValue({ select });

    await productFiltersController(req, res);

    expect(productModel.find).toHaveBeenCalledWith({});
    expect(productModel.countDocuments).toHaveBeenCalledWith({});
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: mockProducts,
      total: 2,
    });
  });

  test("should default checked and radio to empty arrays when omitted from request body", async () => {
    req.body = {};
    const mockProducts = [{ _id: "1" }];
    const sort = jest.fn().mockResolvedValue(mockProducts);
    const limit = jest.fn().mockReturnValue({ sort });
    const skip = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ skip });
    productModel.countDocuments.mockResolvedValue(mockProducts.length);
    productModel.find.mockReturnValue({ select });

    await productFiltersController(req, res);

    expect(productModel.find).toHaveBeenCalledWith({});
    expect(productModel.countDocuments).toHaveBeenCalledWith({});
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: mockProducts,
      total: 1,
    });
  });

  test("should paginate filtered products using the requested page", async () => {
    req.body = {
      checked: ["cat1"],
      radio: [],
      page: 2,
    };

    const mockProducts = [{ _id: "7", name: "Product 7", category: "cat1" }];
    const sort = jest.fn().mockResolvedValue(mockProducts);
    const limit = jest.fn().mockReturnValue({ sort });
    const skip = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ skip });
    productModel.countDocuments.mockResolvedValue(7);
    productModel.find.mockReturnValue({ select });

    await productFiltersController(req, res);

    expect(productModel.find).toHaveBeenCalledWith({
      category: ["cat1"],
    });
    expect(skip).toHaveBeenCalledWith(6);
    expect(limit).toHaveBeenCalledWith(6);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: mockProducts,
      total: 7,
    });
  });

  // Error handling
  test("should handle errors gracefully", async () => {
    const error = new Error("Error While Filtering Products");
    productModel.countDocuments.mockResolvedValue(0);
    const select = jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          sort: jest.fn().mockRejectedValue(error),
        }),
      }),
    });
    productModel.find.mockReturnValue({ select });

    await productFiltersController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Error While Filtering Products",
      error: error,
    });
  });
});

// Yeo Yi Wen, A0273575U
describe("productCountController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock request and response
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  // Happy Path
  test("should return product count successfully", async () => {
    // Arrange
    productModel.find.mockReturnValue({
      estimatedDocumentCount: jest.fn().mockResolvedValue(67),
    });

    // Act
    await productCountController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      total: 67,
    });
  });

  // Error: estimatedDocumentCount fails
  test("should handle errors from estimatedDocumentCount() gracefully", async () => {
    // Arrange - set up error for estimatedDocumentCount()
    const error = new Error("error from estimatedDocumentCount()");
    productModel.find.mockReturnValue({
      estimatedDocumentCount: jest.fn().mockRejectedValue(error),
    });

    // Act
    await productCountController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: "Error in product count",
      error: error,
      success: false,
    });
  });

  // Error: find itself fails (if you want to test this scenario)
  test("should handle errors from find({}) gracefully", async () => {
    // Arrange - set up error for find({})
    const error = new Error("error from find({})");
    productModel.find.mockImplementation(() => {
      throw error;
    });

    // Act
    await productCountController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: "Error in product count",
      error: error,
      success: false,
    });
  });
});

// Yeo Yi Wen, A0273575U
describe("productListController", () => {
  // Test setups
  let req, res;

  beforeEach(() => {
    req = {
      params: {
        page: "2", // will be changed to suit tests
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // Happy path 1 - Other page which is not page 1
  test("should return product list for a specified page when page param is given", async () => {
    // Arrange
    const mockProducts = [{ _id: "7", name: "Product 7" }];

    productModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockProducts),
          }),
        }),
      }),
    });

    // Act
    await productListController(req, res);

    // Assert
    expect(
      productModel.find().select().skip().limit().sort,
    ).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: mockProducts,
    });
  });

  // Happy path 2 - Page 1
  test("should return product list and default to page 1 when there is no page params", async () => {
    // Arrange
    req.params = {};
    const mockProducts = [{ _id: "1", name: "Product 1" }];

    productModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockProducts),
          }),
        }),
      }),
    });

    // Act
    await productListController(req, res);

    // Assert
    expect(
      productModel.find().select().skip().limit().sort,
    ).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: mockProducts,
    });
  });

  // Happy path 3 - No products found
  test("should return empty array when no products is found on page", async () => {
    // Arrange
    productModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    // Act
    await productListController(req, res);

    // Assert
    expect(
      productModel.find().select().skip().limit().sort,
    ).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: [],
    });
  });

  test("should handle errors gracefully", async () => {
    // Arrange
    const error = new Error("error in per page ctrl");

    productModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockRejectedValue(error),
          }),
        }),
      }),
    });

    // Act
    await productListController(req, res);

    // Assert
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "error in per page ctrl",
      error: error,
    });
  });
});

// Yeo Yi Wen, A0273575U
describe("searchProductController", () => {
  // Test setups
  let req, res;

  beforeEach(() => {
    req = {
      params: {
        keyword: "test",
      },
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // Happy path
  test("should return products that includes keyword", async () => {
    // Arrange
    const mockResults = [
      { name: "Test Product 1" },
      { name: "Test Product 2" },
    ];
    productModel.find.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockResults),
    });

    // Act
    await searchProductController(req, res);

    // Assert
    expect(productModel.find).toHaveBeenCalledWith({
      $or: [
        { name: { $regex: "test", $options: "i" } },
        { description: { $regex: "test", $options: "i" } },
      ],
    });
    expect(res.json).toHaveBeenCalledWith(mockResults);
  });

  test("should return empty array when no matches are found'", async () => {
    // Arrange
    productModel.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });

    // Act
    await searchProductController(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("should handle errors and return status 400", async () => {
    // Arrange
    const error = new Error("Error In Search Product API");
    productModel.find.mockReturnValue({
      select: jest.fn().mockRejectedValue(error),
    });

    // Act
    await searchProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Error In Search Product API",
      error: error,
    });
  });
});

// Yeo Yi Wen, A0273575U
describe("relatedProductController", () => {
  // Test setups
  let req, res;

  beforeEach(() => {
    req = {
      params: {
        pid: "123",
        cid: "456",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // Happy path - All 3 related products are returned
  test("should return all 3 related products", async () => {
    // Arrange
    const mockProducts = [
      { _id: "789", name: "Related 1", category: { _id: "456" } },
      { _id: "101112", name: "Related 2", category: { _id: "456" } },
      { _id: "131415", name: "Related 3", category: { _id: "456" } },
    ];

    productModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockProducts),
        }),
      }),
    });

    // Act
    await relatedProductController(req, res);

    // Assert
    expect(productModel.find().select().limit().populate).toHaveBeenCalledWith(
      "category",
    );
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: mockProducts,
    });
  });

  // Happy path - Related products excluding current product is returned
  test("should oni return 2 related products excluding current product if there are 3 related products", async () => {
    // Arrange
    const allProducts = [
      { _id: "789", name: "Related 1", category: { _id: "456" } },
      { _id: "101112", name: "Related 2", category: { _id: "456" } },
      { _id: "123", name: "Related 3", category: { _id: "456" } }, // Should be excluded
    ];

    // Mock to filter out current product
    productModel.find.mockImplementation((query) => {
      // Filter based on the query
      let filteredProducts = [...allProducts];

      // Apply $ne filter (exclude product with ID matching pid)
      if (query._id && query._id.$ne) {
        filteredProducts = filteredProducts.filter(
          (p) => p._id !== query._id.$ne,
        );
      }

      return {
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(filteredProducts),
          }),
        }),
      };
    });

    // Act
    await relatedProductController(req, res);

    // Assert
    expect(productModel.find).toHaveBeenCalledWith({
      category: "456",
      _id: { $ne: "123" },
    });
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: [
        { _id: "789", name: "Related 1", category: { _id: "456" } },
        { _id: "101112", name: "Related 2", category: { _id: "456" } },
      ],
    });
  });

  // Happy path - Only 3 related products are returned
  test("should return only 3 related products if there are 4", async () => {
    // Arrange
    const allProducts = [
      { _id: "789", name: "Related 1", category: { _id: "456" } },
      { _id: "101112", name: "Related 2", category: { _id: "456" } },
      { _id: "131415", name: "Related 3", category: { _id: "456" } },
      { _id: "123456", name: "Related 4", category: { _id: "456" } },
    ];

    // Mock to simulate limit of 3 related products
    let limitValue;
    productModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockImplementation((limit) => {
          limitValue = limit; // Capture the limit value
          return {
            populate: jest
              .fn()
              .mockResolvedValue(allProducts.slice(0, limitValue)), // Apply limit
          };
        }),
      }),
    });

    // Act
    await relatedProductController(req, res);

    // Assert
    expect(productModel.find().select().limit).toHaveBeenCalledWith(3);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: [
        { _id: "789", name: "Related 1", category: { _id: "456" } },
        { _id: "101112", name: "Related 2", category: { _id: "456" } },
        { _id: "131415", name: "Related 3", category: { _id: "456" } },
      ],
    });
  });

  test("should return empty array when there is no related products", async () => {
    // Arrange
    productModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    // Act
    await relatedProductController(req, res);

    // Assert
    expect(productModel.find().select().limit().populate).toHaveBeenCalledWith(
      "category",
    );
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      products: [],
    });
  });

  test("should handle errors gracefully", async () => {
    // Arrange
    const error = new Error("Error while getting related product");

    productModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          populate: jest.fn().mockRejectedValue(error),
        }),
      }),
    });

    // Act
    await relatedProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Error while getting related product",
      error: error,
    });
  });
});

// Yeo Yi Wen, A0273575U
describe("productCategoryController", () => {
  // Test setups
  let req, res;

  beforeEach(() => {
    req = {
      params: {
        slug: "electronics",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // Happy path
  test("should return products and status 200 when category exists", async () => {
    // Arrange
    const mockCategory = {
      _id: "123",
      name: "Electronics",
      slug: "electronics",
    };
    const mockProducts = [
      { _id: "1", name: "Laptop" },
      { _id: "2", name: "Phone" },
    ];
    categoryModel.findOne.mockResolvedValue(mockCategory);
    productModel.find.mockResolvedValue(mockProducts);

    // Act
    await productCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      category: mockCategory,
      products: mockProducts,
    });
  });

  test("should handle null category and return status 404 when category slug does not exist", async () => {
    // Arrange
    categoryModel.findOne.mockResolvedValue(null);
    productModel.find.mockResolvedValue([]);

    // Act
    await productCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      category: null,
      message: "Category not found",
      products: [],
    });
  });

  test("should handle errors and return status 400", async () => {
    // Arrange
    const error = new Error("Error While Getting products");
    categoryModel.findOne.mockRejectedValue(error);

    // Act
    await productCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      error: error,
      message: "Error While Getting products",
    });
  });
});
