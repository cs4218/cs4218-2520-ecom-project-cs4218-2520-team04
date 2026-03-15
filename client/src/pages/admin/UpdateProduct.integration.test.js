//
// Tan Wei Lian, A0269750U
//
// Integration tests for UpdateProduct page.
// These tests verify the interactions between UpdateProduct's two API-driven
// workflows: (1) getSingleProduct populates multiple state fields that flow
// into form elements, and (2) handleUpdate/handleDelete read all current state
// and dispatch the correct API calls.
// Key integration: the two useEffect calls (getSingleProduct + getAllCategory)
// run concurrently and their results are independently merged into the form state.
// Axios is mocked as it is an external boundary.

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "@testing-library/jest-dom";
import UpdateProduct from "./UpdateProduct";

jest.mock("axios");
jest.mock("react-hot-toast");

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

// Mock react-router-dom params to simulate /update-product/test-slug
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useParams: () => ({ slug: "test-slug" }),
}));

window.matchMedia =
  window.matchMedia ||
  function () {
    return { matches: false, addListener: function () {}, removeListener: function () {} };
  };

const mockProduct = {
  _id: "prod-1",
  name: "Laptop",
  description: "A powerful laptop",
  price: 1000,
  quantity: 5,
  shipping: true,
  category: { _id: "cat-1", name: "Electronics" },
};

const mockCategories = [
  { _id: "cat-1", name: "Electronics" },
  { _id: "cat-2", name: "Clothing" },
];

describe("UpdateProduct — getSingleProduct + getAllCategory interactions with form state", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // getSingleProduct and getAllCategory run concurrently in two useEffects
    axios.get.mockImplementation((url) => {
      if (url.includes("get-product/test-slug")) {
        return Promise.resolve({ data: { product: mockProduct } });
      }
      if (url.includes("get-category")) {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  test("getSingleProduct populates all form fields: name, description, price, quantity", async () => {
    // Integration: getSingleProduct API response flows into multiple independent
    // state setters (setName, setDescription, setPrice, setQuantity), which then
    // populate four different form input elements.
    render(
      <MemoryRouter>
        <UpdateProduct />
      </MemoryRouter>
    );

    await screen.findByDisplayValue("Laptop");
    expect(screen.getByDisplayValue("A powerful laptop")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();
  });

  test("getAllCategory and getSingleProduct both resolve and their results coexist in the UI", async () => {
    // Integration: two concurrent API calls — getSingleProduct sets form values,
    // getAllCategory populates the category dropdown. Both must succeed independently.
    render(
      <MemoryRouter>
        <UpdateProduct />
      </MemoryRouter>
    );

    await screen.findByDisplayValue("Laptop");

    // Categories from getAllCategory should appear in the dropdown
    expect(screen.getByText("Electronics")).toBeInTheDocument();
    expect(screen.getByText("Clothing")).toBeInTheDocument();

    // Both API endpoints should have been called
    expect(axios.get).toHaveBeenCalledWith("/api/v1/product/get-product/test-slug");
    expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
  });

  test("editing a field and submitting sends correct updated FormData via handleUpdate", async () => {
    // Integration: the product ID loaded by getSingleProduct is used in the PUT URL.
    // Edited field values flow into handleUpdate's FormData construction.
    const capturedFormData = {};
    axios.put.mockImplementation(async (url, data) => {
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
          <Route path="/" element={<UpdateProduct />} />
          <Route path="/dashboard/admin/products" element={<div>Products Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByDisplayValue("Laptop");

    // Edit the name field
    fireEvent.change(screen.getByDisplayValue("Laptop"), {
      target: { value: "Gaming Laptop" },
    });

    fireEvent.click(screen.getByText("UPDATE PRODUCT"));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        "/api/v1/product/update-product/prod-1",
        expect.any(FormData)
      );
    });

    // The updated name AND the unchanged fields should all be present in FormData
    expect(capturedFormData.name).toBe("Gaming Laptop");
    expect(capturedFormData.description).toBe("A powerful laptop");
    expect(capturedFormData.price).toBe("1000");
    expect(capturedFormData.quantity).toBe("5");
  });

  test("successful update shows toast and navigates to products list", async () => {
    axios.put.mockResolvedValue({ data: { success: true } });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<UpdateProduct />} />
          <Route path="/dashboard/admin/products" element={<div>Products Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByDisplayValue("Laptop");

    fireEvent.click(screen.getByText("UPDATE PRODUCT"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Product Updated Successfully");
    });
    await screen.findByText("Products Page");
  });

  test("delete workflow: window.prompt confirmation → DELETE API called with correct product ID", async () => {
    // Integration: handleDelete reads the `id` state (set by getSingleProduct)
    // and passes it to the delete API call.
    const originalPrompt = window.prompt;
    window.prompt = jest.fn().mockReturnValue("yes");

    axios.delete.mockResolvedValue({ data: { success: true } });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<UpdateProduct />} />
          <Route path="/dashboard/admin/products" element={<div>Products Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByDisplayValue("Laptop");

    fireEvent.click(screen.getByText("DELETE PRODUCT"));

    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith(
        "/api/v1/product/delete-product/prod-1"
      );
    });
    expect(toast.success).toHaveBeenCalledWith("Product Deleted Successfully");

    window.prompt = originalPrompt;
  });

  test("delete is aborted when user cancels the window.prompt confirmation", async () => {
    // Integration: handleDelete checks the prompt return value before making any API call.
    window.prompt = jest.fn().mockReturnValue(null);

    render(
      <MemoryRouter>
        <UpdateProduct />
      </MemoryRouter>
    );
    await screen.findByDisplayValue("Laptop");

    fireEvent.click(screen.getByText("DELETE PRODUCT"));

    // No API call should have been made
    await waitFor(() => {
      expect(axios.delete).not.toHaveBeenCalled();
    });

    window.prompt = jest.fn();
  });
});
