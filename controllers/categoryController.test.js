import slugify from "slugify";
import categoryModel from "../models/categoryModel.js";
import productModel from "../models/productModel.js";
import {
  createCategoryController,
  updateCategoryController,
  categoryController,
  singleCategoryController,
  deleteCategoryController,
} from "./categoryController.js";

// Mock dependencies
jest.mock("../models/categoryModel.js");
jest.mock("../models/productModel.js");
jest.mock("slugify");

// Helpers to build Express req/res fakes
const mockReq = (overrides = {}) => ({
  body: {},
  params: {},
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  // suppress console.log during tests
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Tan Wei Lian, A0269750U
describe("createCategoryController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
  });

  // if(!name) branch
  test("should return 400 when name is not provided", async () => {
    // Arrange
    req = mockReq({ body: {} });

    // Act
    await createCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Name is required" });
  });

  // if(category) branch
  test("should return 409 with message when category already exists", async () => {
    // Arrange
    req = mockReq({ body: { name: "Electronics" } });
    categoryModel.findOne.mockResolvedValue({ name: "Electronics" });

    // Act
    await createCategoryController(req, res);

    // Assert
    expect(categoryModel.findOne).toHaveBeenCalledWith({ name: "Electronics" });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category Already Exists",
    });
  });

  test("should create and return a new category with 201", async () => {
    // Arrange
    req = mockReq({ body: { name: "Books" } });
    categoryModel.findOne.mockResolvedValue(null);
    slugify.mockReturnValue("books");

    const savedCategory = { name: "Books", slug: "books" }; //mock mongoose
    const saveMock = jest.fn().mockResolvedValue(savedCategory); //mock save()
    categoryModel.mockImplementation(() => ({ save: saveMock }));

    // Act
    await createCategoryController(req, res);

    // Assert
    expect(categoryModel.findOne).toHaveBeenCalledWith({ name: "Books" });
    expect(slugify).toHaveBeenCalledWith("Books");
    expect(categoryModel).toHaveBeenCalledWith({ name: "Books", slug: "books" });
    expect(saveMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "new category created",
      category: savedCategory,
    });
  });

  test("should return 500 when findOne throws an error", async () => {
    // Arrange
    req = mockReq({ body: { name: "Books" } });
    const dbError = new Error("DB connection failed");
    categoryModel.findOne.mockRejectedValue(dbError);

    // Act
    await createCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      error: dbError,
      message: "Error in Category",
    });
  });

  test("should return 500 when save throws an error", async () => {
    // Arrange
    req = mockReq({ body: { name: "Books" } });
    categoryModel.findOne.mockResolvedValue(null);
    slugify.mockReturnValue("books");

    const saveError = new Error("Save failed");
    categoryModel.mockImplementation(() => ({
      save: jest.fn().mockRejectedValue(saveError),
    }));

    // Act
    await createCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      error: saveError,
      message: "Error in Category",
    });
  });

  test("should return 400 when name is an empty string", async () => {
    // Arrange
    req = mockReq({ body: { name: "" } });

    // Act
    await createCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Name is required" });
  });

  test("should return 400 when name is only whitespace", async () => {
    // Arrange
    req = mockReq({ body: { name: "   " } });

    // Act
    await createCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Name is required" });
  });

  test("should return 400 when name is null", async () => {
    // Arrange — explicit null, caught by !name before .trim() is called
    req = mockReq({ body: { name: null } });

    // Act
    await createCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Name is required" });
  });

  test("should return 500 when name is a non-string type", async () => {
    // Arrange — number passes !name guard, then .trim() throws TypeError
    req = mockReq({ body: { name: 123 } });

    // Act
    await createCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Error in Category",
      })
    );
  });

  test("should trim name before checking existence and saving", async () => {
    // Arrange — name has leading/trailing spaces
    req = mockReq({ body: { name: "  Books  " } });
    categoryModel.findOne.mockResolvedValue(null);
    slugify.mockReturnValue("books");

    const savedCategory = { name: "Books", slug: "books" };
    const saveMock = jest.fn().mockResolvedValue(savedCategory);
    categoryModel.mockImplementation(() => ({ save: saveMock }));

    // Act
    await createCategoryController(req, res);

    // Assert — trimmed value used for findOne, slugify, and model constructor
    expect(categoryModel.findOne).toHaveBeenCalledWith({ name: "Books" });
    expect(slugify).toHaveBeenCalledWith("Books");
    expect(categoryModel).toHaveBeenCalledWith({ name: "Books", slug: "books" });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});


// Tan Wei Lian, A0269750U
describe("updateCategoryController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
  });

  test("should update and return the category with 200", async () => {
    // Arrange
    req = mockReq({
      body: { name: "Updated Electronics" },
      params: { id: "cat123" },
    });
    slugify.mockReturnValue("updated-electronics");

    const updatedCategory = {
      _id: "cat123",
      name: "Updated Electronics",
      slug: "updated-electronics",
    };
    categoryModel.findByIdAndUpdate.mockResolvedValue(updatedCategory);

    // Act
    await updateCategoryController(req, res);

    // Assert
    expect(categoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "cat123",
      { name: "Updated Electronics", slug: "updated-electronics" },
      { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Category Updated Successfully",
      category: updatedCategory,
    });
  });

  test("should return 500 when findByIdAndUpdate throws an error", async () => {
    // Arrange
    req = mockReq({
      body: { name: "Updated" },
      params: { id: "cat123" },
    });
    slugify.mockReturnValue("updated");
    const dbError = new Error("Update failed");
    categoryModel.findByIdAndUpdate.mockRejectedValue(dbError);

    // Act
    await updateCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      error: dbError,
      message: "Error while updating category",
    });
  });

  test("should return 400 when name is not provided", async () => {
    // Arrange
    req = mockReq({ body: {}, params: { id: "cat123" } });

    // Act
    await updateCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Name is required" });
    expect(categoryModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("should return 400 when name is only whitespace", async () => {
    // Arrange
    req = mockReq({ body: { name: "   " }, params: { id: "cat123" } });

    // Act
    await updateCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Name is required" });
    expect(categoryModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("should return 400 when name is null", async () => {
    // Arrange — explicit null, caught by !name before .trim() is called
    req = mockReq({ body: { name: null }, params: { id: "cat123" } });

    // Act
    await updateCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ success: false, message: "Name is required" });
    expect(categoryModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("should return 500 when name is a non-string type", async () => {
    // Arrange — number passes !name guard, then .trim() throws TypeError
    req = mockReq({ body: { name: 42 }, params: { id: "cat123" } });

    // Act
    await updateCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Error while updating category",
      })
    );
    expect(categoryModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("should trim name before updating", async () => {
    // Arrange — name has surrounding spaces
    req = mockReq({
      body: { name: "  Gadgets  " },
      params: { id: "cat123" },
    });
    slugify.mockReturnValue("gadgets");
    const updatedCategory = { _id: "cat123", name: "Gadgets", slug: "gadgets" };
    categoryModel.findByIdAndUpdate.mockResolvedValue(updatedCategory);

    // Act
    await updateCategoryController(req, res);

    // Assert — trimmed value used
    expect(categoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "cat123",
      { name: "Gadgets", slug: "gadgets" },
      { new: true }
    );
    expect(slugify).toHaveBeenCalledWith("Gadgets");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should return 404 when id does not exist", async () => {
    // Arrange
    req = mockReq({
      body: { name: "Nonexistent" },
      params: { id: "missing999" },
    });
    slugify.mockReturnValue("nonexistent");
    categoryModel.findByIdAndUpdate.mockResolvedValue(null);

    // Act
    await updateCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });
});


// Tan Wei Lian, A0269750U
describe("deleteCategoryController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
  });

  test("should delete a category and return 200", async () => {
    // Arrange
    req = mockReq({ params: { id: "cat123" } });
    productModel.find.mockResolvedValue([]); // No products in category
    categoryModel.findByIdAndDelete.mockResolvedValue({ _id: "cat123" });

    // Act
    await deleteCategoryController(req, res);

    // Assert
    expect(categoryModel.findByIdAndDelete).toHaveBeenCalledWith("cat123");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Category Deleted Successfully",
    });
  });

  test("should return 400 if category has associated products", async () => {
    // Arrange
    req = mockReq({ params: { id: "cat123" } });
    productModel.find.mockResolvedValue([{ name: "Product 1" }]); // Category has products

    // Act
    await deleteCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Cannot delete category with associated products",
    });
    expect(categoryModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test("should return 404 when id does not exist during delete", async () => {
    // Arrange
    req = mockReq({ params: { id: "missing999" } });
    productModel.find.mockResolvedValue([]); // No products
    categoryModel.findByIdAndDelete.mockResolvedValue(null);

    // Act
    await deleteCategoryController(req, res);

    // Assert
    expect(categoryModel.findByIdAndDelete).toHaveBeenCalledWith("missing999");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  test("should return 500 when productModel.find throws an error", async () => {
    // Arrange
    req = mockReq({ params: { id: "cat123" } });
    const dbError = new Error("Product lookup failed");
    productModel.find.mockRejectedValue(dbError);

    // Act
    await deleteCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "error while deleting category",
      error: dbError,
    });
    expect(categoryModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test("should return 500 when findByIdAndDelete throws an error", async () => {
    // Arrange
    req = mockReq({ params: { id: "cat123" } });
    productModel.find.mockResolvedValue([]); // No products
    const dbError = new Error("Delete failed");
    categoryModel.findByIdAndDelete.mockRejectedValue(dbError);

    // Act
    await deleteCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "error while deleting category",
      error: dbError,
    });
  });
});


/* additional unit tests for reference. may delete accordingly
describe("categoryController (get all)", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockReq();
    res = mockRes();
  });

  test("should return all categories with 200", async () => {
    // Arrange
    const categories = [
      { _id: "1", name: "Electronics", slug: "electronics" },
      { _id: "2", name: "Books", slug: "books" },
    ];
    categoryModel.find.mockResolvedValue(categories);

    // Act
    await categoryController(req, res);

    // Assert
    expect(categoryModel.find).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "All Categories List",
      category: categories,
    });
  });

  test("should return an empty array when no categories exist", async () => {
    // Arrange
    categoryModel.find.mockResolvedValue([]);

    // Act
    await categoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "All Categories List",
      category: [],
    });
  });

  test("should return 500 when find throws an error", async () => {
    // Arrange
    const dbError = new Error("Find failed");
    categoryModel.find.mockRejectedValue(dbError);

    // Act
    await categoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      error: dbError,
      message: "Error while getting all categories",
    });
  });
});


describe("singleCategoryController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
  });

  test("should return a single category by slug with 200", async () => {
    // Arrange
    const category = { _id: "1", name: "Electronics", slug: "electronics" };
    req = mockReq({ params: { slug: "electronics" } });
    categoryModel.findOne.mockResolvedValue(category);

    // Act
    await singleCategoryController(req, res);

    // Assert
    expect(categoryModel.findOne).toHaveBeenCalledWith({ slug: "electronics" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Get Single Category Successfully",
      category,
    });
  });

  test("should return category as null when slug does not match", async () => {
    // Arrange
    req = mockReq({ params: { slug: "nonexistent" } });
    categoryModel.findOne.mockResolvedValue(null);

    // Act
    await singleCategoryController(req, res);

    // Assert
    expect(categoryModel.findOne).toHaveBeenCalledWith({ slug: "nonexistent" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Get Single Category Successfully",
      category: null,
    });
  });

  test("should return 500 when findOne throws an error", async () => {
    // Arrange
    req = mockReq({ params: { slug: "electronics" } });
    const dbError = new Error("DB read error");
    categoryModel.findOne.mockRejectedValue(dbError);

    // Act
    await singleCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      error: dbError,
      message: "Error While getting Single Category",
    });
  });
});

*/