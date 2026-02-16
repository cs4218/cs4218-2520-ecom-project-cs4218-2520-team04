import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import Search from "./Search";
import { useSearch } from "../context/search";

// Mocks
jest.mock("../context/search", () => ({
  useSearch: jest.fn(),
}));

jest.mock("./../components/Layout", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));

describe("Search page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows 'No Products Found' when results empty", () => {
    useSearch.mockReturnValue([{ keyword: "x", results: [] }, jest.fn()]);

    render(<Search />);

    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Search Resuts/i })).toBeInTheDocument();
    expect(screen.getByText(/No Products Found/i)).toBeInTheDocument();
  });

  it("shows count and renders product cards when results exist", () => {
    useSearch.mockReturnValue([
      {
        keyword: "x",
        results: [
          {
            _id: "p1",
            name: "Product 1",
            description: "This is a long description for product one",
            price: 10,
          },
          {
            _id: "p2",
            name: "Product 2",
            description: "Another long description for product two",
            price: 20,
          },
        ],
      },
      jest.fn(),
    ]);

    render(<Search />);

    expect(screen.getByText("Found 2")).toBeInTheDocument();
    expect(screen.getByText("Product 1")).toBeInTheDocument();
    expect(screen.getByText("Product 2")).toBeInTheDocument();
    expect(screen.getByText(/\$ 10/)).toBeInTheDocument();
    expect(screen.getByText(/\$ 20/)).toBeInTheDocument();

    // images should exist with correct alt text
    expect(screen.getByAltText("Product 1")).toBeInTheDocument();
    expect(screen.getByAltText("Product 2")).toBeInTheDocument();

    // buttons
    expect(screen.getAllByText(/More Details/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ADD TO CART/i).length).toBeGreaterThan(0);
  });
});
