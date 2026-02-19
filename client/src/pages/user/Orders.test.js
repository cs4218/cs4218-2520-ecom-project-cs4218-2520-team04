import React from "react";
import "@testing-library/jest-dom/extend-expect";
import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import moment from "moment";
import { useAuth } from "../../context/auth";
import Orders from "./Orders";

// Mocks
jest.mock("axios");

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../../components/UserMenu", () => () => (
  <div data-testid="user-menu">UserMenu Mock</div>
));

jest.mock("./../../components/Layout", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));

describe("Orders Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders layout, menu and heading", () => {
    useAuth.mockReturnValue([{ token: "token123" }, jest.fn()]);
    axios.get.mockResolvedValueOnce({ data: [] });

    render(<Orders />);

    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /All Orders/i })).toBeInTheDocument();
  });

  it("does NOT fetch orders when auth.token is missing", async () => {
    useAuth.mockReturnValue([{}, jest.fn()]);

    render(<Orders />);

    await waitFor(() => {
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  it("fetches orders when auth.token exists and renders order + products", async () => {
    useAuth.mockReturnValue([{ token: "token123" }, jest.fn()]);

    const mockOrders = [
        {
        status: "Processing",
        buyer: { name: "Test Buyer" },
        createAt: "2026-02-14T00:00:00.000Z",
        payment: { success: true },
        products: [
            { _id: "p1", name: "Product 1", description: "This is a long description for product one", price: 10 },
            { _id: "p2", name: "Product 2", description: "Another long description for product two", price: 20 },
        ],
        },
    ];

    axios.get.mockResolvedValueOnce({ data: mockOrders });

    render(<Orders />);

    expect(await screen.findByText("Processing")).toBeInTheDocument();

    expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders");

    expect(screen.getByText("Test Buyer")).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    const expectedDate = moment("2026-02-14T00:00:00.000Z").fromNow();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();

    expect(screen.getByText("Product 1")).toBeInTheDocument();
    expect(screen.getByText("Product 2")).toBeInTheDocument();
    expect(screen.getByText(/Price : 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Price : 20/i)).toBeInTheDocument();
  });

  it("renders Failed payment when payment.success is false", async () => {
    useAuth.mockReturnValue([{ token: "token123" }, jest.fn()]);

    axios.get.mockResolvedValueOnce({
      data: [
        {
          status: "Delivered",
          buyer: { name: "Buyer" },
          createAt: "2026-02-14T00:00:00.000Z",
          payment: { success: false },
          products: [],
        },
      ],
    });

    render(<Orders />);

    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders");
  });

  it("handles axios error (logs) without crashing", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    useAuth.mockReturnValue([{ token: "token123" }, jest.fn()]);
    axios.get.mockRejectedValueOnce(new Error("Network error"));

    render(<Orders />);

    await waitFor(() => expect(logSpy).toHaveBeenCalled());

    expect(screen.getByRole("heading", { name: /All Orders/i })).toBeInTheDocument();

    logSpy.mockRestore();
  });
});
