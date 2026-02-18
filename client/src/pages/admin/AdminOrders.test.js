//
// Tan Wei Lian, A0269750U
//
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "@testing-library/jest-dom";
import AdminOrders from "./AdminOrders";
import { useAuth } from "../../context/auth";

jest.mock("axios");
jest.mock("react-hot-toast");

jest.mock("antd", () => {
  const React = require("react");
  const Select = ({ children, onChange, defaultValue }) =>
    React.createElement(
      "select",
      {
        "data-testid": "status-select",
        onChange: (e) => onChange && onChange(e.target.value),
        defaultValue,
      },
      children
    );
  Select.Option = ({ children, value }) =>
    React.createElement("option", { value }, children);
  const Badge = ({ children }) => React.createElement("span", null, children);
  return { Select, Badge };
});

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
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
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };

describe("AdminOrders", () => {
  const mockOrders = [
    {
      _id: "order1",
      status: "Not Process",
      buyer: { name: "John Doe" },
      createdAt: "2024-01-15T10:00:00.000Z",
      payment: { success: true },
      products: [
        {
          _id: "p1",
          name: "Laptop",
          description: "A powerful laptop for development",
          price: 999,
        },
      ],
    },
    {
      _id: "order2",
      status: "Shipped",
      buyer: { name: "Jane Smith" },
      createdAt: "2024-02-20T14:30:00.000Z",
      payment: { success: false },
      products: [
        {
          _id: "p2",
          name: "Book",
          description: "An interesting book about testing",
          price: 25,
        },
        {
          _id: "p3",
          name: "Pen",
          description: "A fine writing pen for notes",
          price: 5,
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue([
      { token: "test-token", user: { name: "Admin" } },
      jest.fn(),
    ]);
    axios.get.mockResolvedValue({ data: mockOrders });
  });

  test("should render heading", async () => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    // Assert
    expect(screen.getByText("All Orders")).toBeInTheDocument();
  });

  test("should fetch and display orders when auth token exists", async () => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/all-orders");
    });
    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  test("should NOT fetch orders when auth token is missing", async () => {
    // Arrange
    useAuth.mockReturnValue([{}, jest.fn()]);

    // Act
    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(axios.get).not.toHaveBeenCalledWith("/api/v1/auth/all-orders");
    });
  });

  test("should NOT fetch orders when auth is null", async () => {
    // Arrange
    useAuth.mockReturnValue([null, jest.fn()]);

    // Act
    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(axios.get).not.toHaveBeenCalledWith("/api/v1/auth/all-orders");
    });
  });

  test("should display payment status as Success or Failed", async () => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText("Success")).toBeInTheDocument();
    });
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  test("should display product count for each order", async () => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    // Assert — order1 has 1 product, order2 has 2 products
    // Use within() on table rows to check the Quantity column specifically
    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(2);

    const firstTableRows = within(tables[0]).getAllByRole("row");
    const firstRowCells = within(firstTableRows[1]).getAllByRole("cell");
    expect(firstRowCells[firstRowCells.length - 1]).toHaveTextContent("1");

    const secondTableRows = within(tables[1]).getAllByRole("row");
    const secondRowCells = within(secondTableRows[1]).getAllByRole("cell");
    expect(secondRowCells[secondRowCells.length - 1]).toHaveTextContent("2");
  });

  test("should display product details within orders", async () => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText("Laptop")).toBeInTheDocument();
    });
    expect(screen.getByText("Price : 999")).toBeInTheDocument();
    expect(screen.getByText("Book")).toBeInTheDocument();
    expect(screen.getByText("Price : 25")).toBeInTheDocument();
  });

  test("should display truncated product descriptions (first 30 chars)", async () => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    // Assert — "A powerful laptop for developm" = first 30 chars of "A powerful laptop for development"
    await waitFor(() => {
      expect(screen.getByText("A powerful laptop for developm")).toBeInTheDocument();
    });
  });

  test("should display product photos with correct src", async () => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      const laptopImg = screen.getByAltText("Laptop");
      expect(laptopImg).toHaveAttribute(
        "src",
        "/api/v1/product/product-photo/p1"
      );
    });
  });

  test("should call API to update order status when changed", async () => {
    // Arrange
    axios.put.mockResolvedValue({ data: {} });

    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Act — change status of first order
    const selects = screen.getAllByTestId("status-select");
    fireEvent.change(selects[0], { target: { value: "Shipped" } });

    // Assert
    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        "/api/v1/auth/order-status/order1",
        { status: "Shipped" }
      );
    });
  });

  test("should display all status options in the dropdown", async () => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    // Assert — status options are rendered for each order
    await waitFor(() => {
      expect(screen.getAllByText("Processing").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Shipped").length).toBeGreaterThan(0);
  });

  test("should handle API error when fetching orders", async () => {
    // Arrange
    axios.get.mockRejectedValue(new Error("Network error"));

    // Act
    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    // Assert — component doesn't crash, no orders displayed
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/all-orders");
    });
    expect(screen.getByText("All Orders")).toBeInTheDocument();
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  test("should handle API error when updating order status", async () => {
    // Arrange
    axios.put.mockRejectedValue(new Error("Update failed"));

    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Act — change status of first order
    const selects = screen.getAllByTestId("status-select");
    fireEvent.change(selects[0], { target: { value: "Shipped" } });

    // Assert — no crash, put was called
    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        "/api/v1/auth/order-status/order1",
        { status: "Shipped" }
      );
    });
    expect(screen.getByText("All Orders")).toBeInTheDocument();
  });

  test("should render empty state when no orders exist", async () => {
    // Arrange
    axios.get.mockResolvedValue({ data: [] });

    // Act
    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/all-orders");
    });
    expect(screen.getByText("All Orders")).toBeInTheDocument();
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });
});
