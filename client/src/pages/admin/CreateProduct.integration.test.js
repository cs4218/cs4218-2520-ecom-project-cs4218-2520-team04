//
// Tan Wei Lian, A0269750U
//
// Integration tests for CreateProduct page.
// These tests verify interactions between the CreateProduct component's state
// management, form elements, and the API call layer.
// Key integration: multiple independent form fields (name, description, price,
// quantity, photo, category) all flow into a single FormData on submit,
// and the category list loaded from the API populates the Select dropdown.
// Axios is mocked as it is an external boundary.

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "@testing-library/jest-dom";
import CreateProduct from "./CreateProduct";

jest.mock("axios");
jest.mock("react-hot-toast");

// silence console noise in tests
beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

// Mock antd components for stable rendering in jsdom
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

window.matchMedia =
  window.matchMedia ||
  function () {
    return { matches: false, addListener: function () {}, removeListener: function () {} };
  };

const mockCategories = [
  { _id: "cat-1", name: "Electronics" },
  { _id: "cat-2", name: "Clothing" },
];

describe("CreateProduct — interactions between form fields, category API, and submission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({
      data: { success: true, category: mockCategories },
    });
  });

  test("fetches categories on mount and populates the category dropdown", async () => {
    // Integration: getAllCategory API response flows into the Select component's options.
    render(
      <MemoryRouter>
        <CreateProduct />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
    });

    // Wait for React to re-render with the populated categories
    await screen.findByText("Electronics");
    expect(screen.getByText("Clothing")).toBeInTheDocument();
  });

  test("all form fields flow into the FormData assembled by handleCreate", async () => {
    // Integration: multiple independent state values (name, description, price,
    // quantity, category) are all aggregated into a single FormData on submit.
    // This tests the interaction between each field's onChange handler and the
    // centralized handleCreate function that reads all state at once.
    const capturedFormData = {};
    axios.post.mockImplementation(async (url, data) => {
      // Capture what was appended to FormData
      if (data instanceof FormData) {
        for (const [key, value] of data.entries()) {
          capturedFormData[key] = value;
        }
      }
      return { data: { success: true } };
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CreateProduct />} />
          <Route path="/dashboard/admin/products" element={<div>Products Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("Electronics");

    // Fill in all text fields
    fireEvent.change(screen.getByPlaceholderText("write a name"), {
      target: { value: "Laptop Pro" },
    });
    fireEvent.change(screen.getByPlaceholderText("write a description"), {
      target: { value: "High-performance laptop" },
    });
    fireEvent.change(screen.getByPlaceholderText("write a Price"), {
      target: { value: "1200" },
    });
    fireEvent.change(screen.getByPlaceholderText("write a quantity"), {
      target: { value: "5" },
    });

    // Select a category via the antd Select (placeholder is "Select a category")
    const categorySelect = screen.getByTestId("select-Select-a-category");
    fireEvent.change(categorySelect, { target: { value: "cat-1" } });

    // Submit
    fireEvent.click(screen.getByText("CREATE PRODUCT"));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "/api/v1/product/create-product",
        expect.any(FormData)
      );
    });

    // All fields should have flowed correctly into FormData
    expect(capturedFormData.name).toBe("Laptop Pro");
    expect(capturedFormData.description).toBe("High-performance laptop");
    expect(capturedFormData.price).toBe("1200");
    expect(capturedFormData.quantity).toBe("5");
    expect(capturedFormData.category).toBe("cat-1");
  });

  test("navigates to products page and shows success toast after successful creation", async () => {
    // Integration: successful API response → toast.success AND navigate both triggered.
    axios.post.mockResolvedValue({ data: { success: true } });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CreateProduct />} />
          <Route path="/dashboard/admin/products" element={<div>Products Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("Electronics");

    fireEvent.change(screen.getByPlaceholderText("write a name"), {
      target: { value: "Headphones" },
    });
    fireEvent.click(screen.getByText("CREATE PRODUCT"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Product Created Successfully");
    });
    await screen.findByText("Products Page");
  });

  test("shows error toast when API returns success: false (state + API response interaction)", async () => {
    // Integration: API failure response → toast.error is triggered with the API message.
    axios.post.mockResolvedValue({
      data: { success: false, message: "Name is Required" },
    });

    render(
      <MemoryRouter>
        <CreateProduct />
      </MemoryRouter>
    );
    await screen.findByText("Electronics");

    fireEvent.click(screen.getByText("CREATE PRODUCT"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Name is Required");
    });
  });
});
