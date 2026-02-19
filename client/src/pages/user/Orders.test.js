//
// Lu Yixuan, Deborah, A0277911X
//
import React from "react";
import { render, screen, within } from "@testing-library/react";
import Orders from "./Orders";
import axios from "axios";

jest.mock("axios");

jest.mock("./../../components/Layout", () => (props) => (
  <div>
    <div data-testid="layout-title">{props.title}</div>
    {props.children}
  </div>
));

jest.mock("../../components/UserMenu", () => () => <div data-testid="user-menu" />);

jest.mock("moment", () => {
  return (date) => ({
    fromNow: () => `fromNow(${String(date)})`,
  });
});

const mockUseAuth = jest.fn();
jest.mock("../../context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const getRowByStatus = async (status) => {
  const statusCell = await screen.findByText(status);
  const row = statusCell.closest("tr");
  if (!row) throw new Error(`Row not found for status: ${status}`);
  return row;
};

describe("Orders (unit/component)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue([{ token: null }, jest.fn()]);
  });

  test("does NOT fetch orders when auth.token is missing", () => {
    // Given
    mockUseAuth.mockReturnValue([{ token: null }, jest.fn()]);

    // When
    render(<Orders />);

    // Then
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("fetches orders when auth.token exists", async () => {
    // Given
    mockUseAuth.mockReturnValue([{ token: "abc" }, jest.fn()]);
    axios.get.mockResolvedValueOnce({ data: [] });

    // When
    render(<Orders />);

    // Then
    await screen.findByText("All Orders");
    expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders");
  });

  test("renders fetched order + product details after successful fetch", async () => {
    // Given
    mockUseAuth.mockReturnValue([{ token: "abc" }, jest.fn()]);
    axios.get.mockResolvedValueOnce({
      data: [
        {
          _id: "o1",
          status: "Processing",
          buyer: { name: "Test" },
          createdAt: "2026-02-18T00:00:00.000Z",
          payment: { success: true },
          products: [
            {
              _id: "p1",
              name: "Item A",
              description: "This is a long description for item A",
              price: 12.34,
            },
          ],
        },
      ],
    });

    // When
    render(<Orders />);

    // Then
    const row = await getRowByStatus("Processing");
    const cells = within(row).getAllByRole("cell");

    // columns: #, Status, Buyer, date, Payment, Quantity
    expect(cells[0]).toHaveTextContent("1"); // row number
    expect(cells[1]).toHaveTextContent("Processing");
    expect(cells[2]).toHaveTextContent("Test");
    expect(cells[3]).toHaveTextContent("fromNow(2026-02-18T00:00:00.000Z)");
    expect(cells[4]).toHaveTextContent("Success");
    expect(cells[5]).toHaveTextContent("1"); // quantity

    // product card content (note: description is substring(0, 30) in component)
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText("Price : 12.34")).toBeInTheDocument();
    expect(screen.getByText(/This is a long description/i)).toBeInTheDocument();
  });

  test('shows "Failed" when payment.success is false', async () => {
    // Given
    mockUseAuth.mockReturnValue([{ token: "abc" }, jest.fn()]);
    axios.get.mockResolvedValueOnce({
      data: [
        {
          _id: "o2",
          status: "Shipped",
          buyer: { name: "Test" },
          createdAt: "2026-02-01T00:00:00.000Z",
          payment: { success: false },
          products: [],
        },
      ],
    });

    // When
    render(<Orders />);

    // Then
    const row = await getRowByStatus("Shipped");
    const cells = within(row).getAllByRole("cell");
    expect(cells[4]).toHaveTextContent("Failed");
    expect(cells[5]).toHaveTextContent("0");
  });

  test("logs error when fetching orders fails", async () => {
    // Given
    mockUseAuth.mockReturnValue([{ token: "abc" }, jest.fn()]);
    axios.get.mockRejectedValueOnce(new Error("network"));
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // When
    render(<Orders />);

    // Then
    await screen.findByText("All Orders");
    expect(logSpy).toHaveBeenCalled();
    expect(screen.queryByText("Processing")).not.toBeInTheDocument();

    logSpy.mockRestore();
  });
});
