//
// Tan Wei Lian, A0269750U
//
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import axios from "axios";
import toast from "react-hot-toast";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import CreateProduct from "./CreateProduct";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("axios");
jest.mock("react-hot-toast");

jest.mock("antd", () => {
  const React = require("react");
  const Select = ({ children, onChange, value, placeholder }) =>
    React.createElement(
      "select",
      {
        "data-testid": `select-${(placeholder || "").replace(/\s+/g, "-")}`,
        onChange: (e) => onChange && onChange(e.target.value),
        value,
      },
      children
    );
  Select.Option = ({ children, value }) =>
    React.createElement("option", { value }, children);
  const Badge = ({ children }) => React.createElement("span", null, children);
  return { Select, Badge };
});

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(() => [null, jest.fn()]),
}));
jest.mock("../../context/cart", () => ({
  useCart: jest.fn(() => [null, jest.fn()]),
}));
jest.mock("../../context/search", () => ({
  useSearch: jest.fn(() => [{ keyword: "" }, jest.fn()]),
}));
jest.mock("../../hooks/useCategory", () => jest.fn(() => []));

// Mock URL.createObjectURL for photo preview
global.URL.createObjectURL = jest.fn(() => "mocked-url");

window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };

describe("CreateProduct", () => {
  const mockCategories = [
    { _id: "cat1", name: "Electronics" },
    { _id: "cat2", name: "Books" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({
      data: { success: true, category: mockCategories },
    });
  });

  test("should render heading and fetch categories on mount", async () => {
    // Arrange & Act
    render(<MemoryRouter><CreateProduct /></MemoryRouter>);

    // Assert
    expect(screen.getByRole("heading", { name: "Create Product" })).toBeInTheDocument();
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
    });
  });

  test("should display category options in the dropdown", async () => {
    // Arrange & Act
    render(<MemoryRouter><CreateProduct /></MemoryRouter>);

    // Assert
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });
    expect(screen.getByText("Books")).toBeInTheDocument();
  });

  test("should render all form inputs", async () => {
    // Arrange & Act
    render(<MemoryRouter><CreateProduct /></MemoryRouter>);

    // Assert
    expect(screen.getByPlaceholderText("write a name")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("write a description")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("write a Price")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("write a quantity")
    ).toBeInTheDocument();
    expect(screen.getByText("Upload Photo")).toBeInTheDocument();
  });

  test("should create product successfully and navigate", async () => {
    // Arrange
    axios.post.mockResolvedValue({
      data: { success: true, message: "Product Created Successfully" },
    });
    const appendSpy = jest.spyOn(FormData.prototype, "append");

    render(<MemoryRouter><CreateProduct /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act — fill in form fields
    fireEvent.change(screen.getByPlaceholderText("write a name"), {
      target: { value: "New Product" },
    });
    fireEvent.change(screen.getByPlaceholderText("write a description"), {
      target: { value: "A new product" },
    });
    fireEvent.change(screen.getByPlaceholderText("write a Price"), {
      target: { value: "29.99" },
    });
    fireEvent.change(screen.getByPlaceholderText("write a quantity"), {
      target: { value: "10" },
    });

    // Click create
    fireEvent.click(screen.getByText("CREATE PRODUCT"));

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "/api/v1/product/create-product",
        expect.any(FormData)
      );
    });
    expect(appendSpy).toHaveBeenCalledWith("name", "New Product");
    expect(appendSpy).toHaveBeenCalledWith("description", "A new product");
    expect(appendSpy).toHaveBeenCalledWith("price", "29.99");
    expect(appendSpy).toHaveBeenCalledWith("quantity", "10");
    expect(toast.success).toHaveBeenCalledWith("Product Created Successfully");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/products");
    appendSpy.mockRestore();
  });

  test("should include selected category in the FormData", async () => {
    // Arrange
    axios.post.mockResolvedValue({
      data: { success: true, message: "Product Created Successfully" },
    });
    const appendSpy = jest.spyOn(FormData.prototype, "append");

    render(<MemoryRouter><CreateProduct /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act — select category, fill form, submit
    fireEvent.change(screen.getByTestId("select-Select-a-category"), {
      target: { value: "cat1" },
    });
    fireEvent.change(screen.getByPlaceholderText("write a name"), {
      target: { value: "New Product" },
    });
    fireEvent.change(screen.getByPlaceholderText("write a description"), {
      target: { value: "A new product" },
    });
    fireEvent.change(screen.getByPlaceholderText("write a Price"), {
      target: { value: "29.99" },
    });
    fireEvent.change(screen.getByPlaceholderText("write a quantity"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByText("CREATE PRODUCT"));

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
    });
    expect(appendSpy).toHaveBeenCalledWith("category", "cat1");
    appendSpy.mockRestore();
  });

  test("should show error toast when create returns success: false", async () => {
    // Arrange
    axios.post.mockResolvedValue({
      data: { success: false, message: "Name is Required" },
    });

    render(<MemoryRouter><CreateProduct /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getByText("CREATE PRODUCT"));

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Name is Required");
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("should show error toast when create throws an exception", async () => {
    // Arrange
    axios.post.mockRejectedValue(new Error("Network error"));

    render(<MemoryRouter><CreateProduct /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getByText("CREATE PRODUCT"));

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("something went wrong");
    });
  });

  test("should show error toast when fetching categories fails", async () => {
    // Arrange
    axios.get.mockRejectedValue(new Error("Network error"));

    // Act
    render(<MemoryRouter><CreateProduct /></MemoryRouter>);

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Something went wrong in getting category"
      );
    });
  });

  test("should show photo name after file upload", async () => {
    // Arrange
    render(<MemoryRouter><CreateProduct /></MemoryRouter>);
    const file = new File(["photo"], "test.jpg", { type: "image/jpeg" });

    // Act
    const fileInput = screen.getByLabelText("Upload Photo");
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Assert
    await waitFor(() => {
      expect(screen.getByText("test.jpg")).toBeInTheDocument();
    });
  });

  test("should show photo preview after file upload", async () => {
    // Arrange
    render(<MemoryRouter><CreateProduct /></MemoryRouter>);
    const file = new File(["photo"], "test.jpg", { type: "image/jpeg" });

    // Act
    const fileInput = screen.getByLabelText("Upload Photo");
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Assert
    await waitFor(() => {
      expect(screen.getByAltText("product_photo")).toBeInTheDocument();
    });
    expect(screen.getByAltText("product_photo")).toHaveAttribute("src", "mocked-url");
  });
});
