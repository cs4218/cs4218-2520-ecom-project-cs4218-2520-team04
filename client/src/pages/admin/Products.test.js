//
// Tan Wei Lian, A0269750U
//
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "@testing-library/jest-dom";
import Products from "./Products";

jest.mock("axios");
jest.mock("react-hot-toast");

jest.mock("antd", () => {
  const React = require("react");
  const Badge = ({ children }) => React.createElement("span", null, children);
  return { Badge };
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

window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };

describe("Products", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should render heading and fetch products on mount", async () => {
    // Arrange
    const mockProducts = [
      { _id: "1", name: "Product A", description: "Desc A", slug: "product-a" },
      { _id: "2", name: "Product B", description: "Desc B", slug: "product-b" },
    ];
    axios.get.mockResolvedValue({ data: { products: mockProducts } });

    // Act
    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>
    );

    // Assert
    expect(screen.getByText("All Products List")).toBeInTheDocument();
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/product/get-product");
    });
    await waitFor(() => {
      expect(screen.getByText("Product A")).toBeInTheDocument();
    });
    expect(screen.getByText("Product B")).toBeInTheDocument();
  });

  test("should display product name and description in cards", async () => {
    // Arrange
    const mockProducts = [
      { _id: "1", name: "Laptop", description: "A powerful laptop", slug: "laptop" },
    ];
    axios.get.mockResolvedValue({ data: { products: mockProducts } });

    // Act
    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText("Laptop")).toBeInTheDocument();
    });
    expect(screen.getByText("A powerful laptop")).toBeInTheDocument();
  });

  test("should link each product to its update page", async () => {
    // Arrange
    const mockProducts = [
      { _id: "1", name: "Widget", description: "A widget", slug: "widget" },
    ];
    axios.get.mockResolvedValue({ data: { products: mockProducts } });

    // Act
    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Widget/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Widget/i })).toHaveAttribute(
      "href",
      "/dashboard/admin/product/widget"
    );
  });

  test("should display product photo with correct src", async () => {
    // Arrange
    const mockProducts = [
      { _id: "p1", name: "Item", description: "An item", slug: "item" },
    ];
    axios.get.mockResolvedValue({ data: { products: mockProducts } });

    // Act
    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByAltText("Item")).toBeInTheDocument();
    });
    expect(screen.getByAltText("Item")).toHaveAttribute(
      "src",
      "/api/v1/product/product-photo/p1"
    );
  });

  test("should show error toast when fetch fails", async () => {
    // Arrange
    axios.get.mockRejectedValue(new Error("Network error"));

    // Act
    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Something Went Wrong");
    });
  });

  test("should show heading but no product cards before data loads", async () => {
    // Arrange — use a deferred promise to keep data loading
    let resolveProducts;
    axios.get.mockReturnValue(
      new Promise((resolve) => {
        resolveProducts = resolve;
      })
    );

    // Act
    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>
    );

    // Assert — heading visible, no product links yet
    expect(screen.getByText("All Products List")).toBeInTheDocument();
    const allLinks = screen.queryAllByRole("link");
    const productLinks = allLinks.filter((link) =>
      link.getAttribute("href")?.includes("/dashboard/admin/product/")
    );
    expect(productLinks).toHaveLength(0);

    // Cleanup — resolve the pending promise
    resolveProducts({ data: { products: [] } });
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });
  });

  test("should render empty list when API returns no products", async () => {
    // Arrange
    axios.get.mockResolvedValue({ data: { products: [] } });

    // Act
    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/product/get-product");
    });
    expect(screen.getByText("All Products List")).toBeInTheDocument();
    // No product-specific links rendered
    const allLinks = screen.queryAllByRole("link");
    const productLinks = allLinks.filter((link) =>
      link.getAttribute("href")?.includes("/dashboard/admin/product/")
    );
    expect(productLinks).toHaveLength(0);
  });
});
