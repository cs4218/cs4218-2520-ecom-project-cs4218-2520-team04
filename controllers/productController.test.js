import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
import orderModel from "../models/orderModel.js";
import slugify from "slugify";
import fs from "fs";
import {
  createProductController,
  deleteProductController,
  updateProductController,
} from "./productController.js";

// Mock dependencies
jest.mock("../models/productModel.js");
jest.mock("../models/categoryModel.js");
jest.mock("../models/orderModel.js");
jest.mock("slugify");
jest.mock("fs");
jest.mock("braintree", () => ({
  BraintreeGateway: jest.fn(() => ({})),
  Environment: { Sandbox: "sandbox" },
}));

// Helpers
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Name is Required" });
  });

  test("should return 400 when name is whitespace only", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), name: "   " } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Name is Required" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Description is Required" });
  });

  test("should return 400 when description is whitespace only", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), description: "  " } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Description is Required" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Price is Required and must be a non-negative number" });
  });

  test("should return 400 when price is not a number", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), price: "abc" } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Price is Required and must be a non-negative number" });
  });

  test("should return 400 when price is an empty string", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), price: "" } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Price is Required and must be a non-negative number" });
  });

  test("should return 400 when price is negative", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), price: "-10" } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Price is Required and must be a non-negative number" });
  });

  test("should return 400 when price is -1 (boundary below 0)", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), price: -1 } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Price is Required and must be a non-negative number" });
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
      expect.objectContaining({ success: true, message: "Product Created Successfully" })
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category not found" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category is Required" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Quantity is Required and must be a non-negative number" });
  });

  test("should return 400 when quantity is not a number", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), quantity: "xyz" } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Quantity is Required and must be a non-negative number" });
  });

  test("should return 400 when quantity is negative", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), quantity: -5 } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Quantity is Required and must be a non-negative number" });
  });

  test("should return 400 when quantity is -1 (boundary below 0)", async () => {
    // Arrange
    const req = mockReq({ fields: { ...validFields(), quantity: -1 } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Quantity is Required and must be a non-negative number" });
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
      expect.objectContaining({ success: true, message: "Product Created Successfully" })
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category not found" });
  });

  // validate photo
  test("should return 400 when photo is missing", async () => {
    // Arrange
    const req = mockReq({ files: {} });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Photo is Required" });
  });

  test("should return 400 when photo exceeds 1MB", async () => {
    // Arrange
    const req = mockReq({ files: { photo: { size: 1000001, path: "/tmp/big.jpg", type: "image/jpeg" } } });

    // Act
    await createProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Photo should be less than 1mb" });
  });

  test("should accept photo of exactly 1000000 bytes (boundary at limit)", async () => {
    // Arrange — size === 1000000 passes because check is > not >=
    const req = mockReq({
      files: { photo: { size: 1000000, path: "/tmp/photo.jpg", type: "image/jpeg" } },
    });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await createProductController(req, res);

    // Assert — passes photo validation, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category not found" });
  });

  test("should accept photo of 999999 bytes (boundary below limit)", async () => {
    // Arrange
    const req = mockReq({
      files: { photo: { size: 999999, path: "/tmp/photo.jpg", type: "image/jpeg" } },
    });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await createProductController(req, res);

    // Assert — passes photo validation, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category not found" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category not found" });
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
      expect.objectContaining({ name: "Test Product", slug: "test-product" })
    );
    expect(fs.readFileSync).toHaveBeenCalledWith("/tmp/photo.jpg");
    expect(productInstance.photo.data).toEqual(Buffer.from("photo-data"));
    expect(productInstance.photo.contentType).toBe("image/jpeg");
    expect(saveMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Product Created Successfully" })
    );
  });

  test("should trim name and description before saving", async () => {
    // Arrange — both have surrounding whitespace
    const req = mockReq({
      fields: { ...validFields(), name: "  Padded Name  ", description: "  Padded Desc  " },
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
      })
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
      })
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Name is Required" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Name is Required" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Description is Required" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Description is Required" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Price is Required and must be a non-negative number" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Price is Required and must be a non-negative number" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Price is Required and must be a non-negative number" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Price is Required and must be a non-negative number" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Price is Required and must be a non-negative number" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category not found" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category not found" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category is Required" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Quantity is Required and must be a non-negative number" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Quantity is Required and must be a non-negative number" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Quantity is Required and must be a non-negative number" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Quantity is Required and must be a non-negative number" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category not found" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category not found" });
  });

  test("should return 400 when photo exceeds 1MB", async () => {
    // Arrange
    const req = mockReq({
      files: { photo: { size: 1000001, path: "/tmp/big.jpg", type: "image/jpeg" } },
      params: { pid: "p1" },
    });

    // Act
    await updateProductController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Photo should be less than 1mb" });
  });

  test("should accept photo of exactly 1000000 bytes (boundary at limit)", async () => {
    // Arrange — size === 1000000 passes because check is > not >=
    const req = mockReq({
      files: { photo: { size: 1000000, path: "/tmp/photo.jpg", type: "image/jpeg" } },
      params: { pid: "p1" },
    });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await updateProductController(req, res);

    // Assert — passes photo validation, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category not found" });
  });

  test("should accept photo of 999999 bytes (boundary below limit)", async () => {
    // Arrange
    const req = mockReq({
      files: { photo: { size: 999999, path: "/tmp/photo.jpg", type: "image/jpeg" } },
      params: { pid: "p1" },
    });
    categoryModel.findById.mockResolvedValue(null);

    // Act
    await updateProductController(req, res);

    // Assert — passes photo validation, fails at category lookup
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category not found" });
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
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Category not found" });
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
      { new: true }
    );
    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(updatedProduct.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Product Updated Successfully" })
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
      fields: { ...validFields(), name: "  Padded  ", description: "  Padded Desc  " },
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
      { new: true }
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
