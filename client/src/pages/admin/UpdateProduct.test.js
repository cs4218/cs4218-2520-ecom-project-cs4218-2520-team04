//
// Tan Wei Lian, A0269750U
//
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import axios from "axios";
import toast from "react-hot-toast";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import UpdateProduct from "./UpdateProduct";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
  useParams: () => ({ slug: "test-product" }),
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

describe("UpdateProduct", () => {
  const mockProduct = {
    _id: "p1",
    name: "Test Product",
    description: "Test Description",
    price: 29.99,
    quantity: 10,
    shipping: true,
    category: { _id: "cat1", name: "Electronics" },
  };
  const mockCategories = [
    { _id: "cat1", name: "Electronics" },
    { _id: "cat2", name: "Books" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation((url) => {
      if (url.includes("get-product")) {
        return Promise.resolve({ data: { product: mockProduct } });
      }
      if (url.includes("get-category")) {
        return Promise.resolve({
          data: { success: true, category: mockCategories },
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });
  });

  test("should render heading and fetch product data on mount", async () => {
    // Arrange & Act
    render(<MemoryRouter><UpdateProduct /></MemoryRouter>);

    // Assert
    expect(screen.getByText("Update Product")).toBeInTheDocument();
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "/api/v1/product/get-product/test-product"
      );
    });
    expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
  });

  test("should populate form fields with product data", async () => {
    // Arrange & Act
    render(<MemoryRouter><UpdateProduct /></MemoryRouter>);

    // Assert
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Product")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Test Description")).toBeInTheDocument();
    expect(screen.getByDisplayValue("29.99")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
  });

  test("should display existing product photo when no new photo is uploaded", async () => {
    // Arrange & Act
    render(<MemoryRouter><UpdateProduct /></MemoryRouter>);

    // Assert
    await waitFor(() => {
      expect(screen.getByAltText("product_photo")).toHaveAttribute(
        "src",
        "/api/v1/product/product-photo/p1"
      );
    });
  });

  test("should update product successfully and navigate", async () => {
    // Arrange
    axios.put.mockResolvedValue({
      data: { success: true, message: "Product Updated Successfully" },
    });
    const appendSpy = jest.spyOn(FormData.prototype, "append");

    render(<MemoryRouter><UpdateProduct /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Product")).toBeInTheDocument();
    });

    // Act — change name and submit
    fireEvent.change(screen.getByPlaceholderText("write a name"), {
      target: { value: "Updated Product" },
    });
    fireEvent.click(screen.getByText("UPDATE PRODUCT"));

    // Assert
    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        "/api/v1/product/update-product/p1",
        expect.any(FormData)
      );
    });
    expect(appendSpy).toHaveBeenCalledWith("name", "Updated Product");
    expect(appendSpy).toHaveBeenCalledWith("description", "Test Description");
    expect(appendSpy).toHaveBeenCalledWith("price", 29.99);
    expect(appendSpy).toHaveBeenCalledWith("quantity", 10);
    expect(toast.success).toHaveBeenCalledWith("Product Updated Successfully");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/products");
    appendSpy.mockRestore();
  });

  test("should show error toast when update returns success: false", async () => {
    // Arrange
    axios.put.mockResolvedValue({
      data: { success: false, message: "Validation error" },
    });

    render(<MemoryRouter><UpdateProduct /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Product")).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getByText("UPDATE PRODUCT"));

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Validation error");
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("should show error toast when update throws an exception", async () => {
    // Arrange
    axios.put.mockRejectedValue(new Error("Network error"));

    render(<MemoryRouter><UpdateProduct /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Product")).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getByText("UPDATE PRODUCT"));

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("something went wrong");
    });
  });

  test("should delete product when user confirms via prompt", async () => {
    // Arrange
    window.prompt = jest.fn(() => "yes");
    axios.delete.mockResolvedValue({ data: { success: true } });

    render(<MemoryRouter><UpdateProduct /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Product")).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getByText("DELETE PRODUCT"));

    // Assert
    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith(
        "/api/v1/product/delete-product/p1"
      );
    });
    expect(window.prompt).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Product Deleted Successfully");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/products");
  });

  test("should NOT delete product when user cancels the prompt", async () => {
    // Arrange
    window.prompt = jest.fn(() => null);

    render(<MemoryRouter><UpdateProduct /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Product")).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getByText("DELETE PRODUCT"));

    // Assert
    expect(window.prompt).toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("should show error toast when delete throws an exception", async () => {
    // Arrange
    window.prompt = jest.fn(() => "yes");
    axios.delete.mockRejectedValue(new Error("Server error"));

    render(<MemoryRouter><UpdateProduct /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Product")).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getByText("DELETE PRODUCT"));

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Something went wrong");
    });
  });

  test("should show new photo preview when a file is uploaded", async () => {
    // Arrange
    render(<MemoryRouter><UpdateProduct /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Product")).toBeInTheDocument();
    });
    const file = new File(["photo"], "new-photo.jpg", { type: "image/jpeg" });

    // Act
    const fileInput = screen.getByLabelText("Upload Photo");
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Assert
    await waitFor(() => {
      expect(screen.getByText("new-photo.jpg")).toBeInTheDocument();
    });
    expect(screen.getByAltText("product_photo")).toHaveAttribute("src", "mocked-url");
  });

  test("should handle getSingleProduct API failure gracefully", async () => {
    // Arrange — override get to reject for get-product URL
    axios.get.mockImplementation((url) => {
      if (url.includes("get-product")) {
        return Promise.reject(new Error("Network error"));
      }
      if (url.includes("get-category")) {
        return Promise.resolve({
          data: { success: true, category: mockCategories },
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    // Act & Assert — component should render without crashing
    render(<MemoryRouter><UpdateProduct /></MemoryRouter>);
    expect(screen.getByText("Update Product")).toBeInTheDocument();
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "/api/v1/product/get-product/test-product"
      );
    });
  });

  test("should display category options in the dropdown", async () => {
    // Arrange & Act
    render(<MemoryRouter><UpdateProduct /></MemoryRouter>);

    // Assert
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });
    expect(screen.getByText("Books")).toBeInTheDocument();
  });
});
