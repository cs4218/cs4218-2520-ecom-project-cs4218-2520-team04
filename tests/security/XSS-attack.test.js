// A0272558U, Teo Kai Xiang
// Written by GPT 5.4 based on test plans written by me. Reviewed after

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";

const maliciousName = `<img src=x onerror="window.__xssAttack = 'name'" />`;
const maliciousDescription = `<script>window.__xssAttack = 'description'</script>`;
const mockNavigate = jest.fn();
const mockSetCart = jest.fn();

jest.mock("axios");
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));
jest.mock("../../client/src/context/cart", () => ({
  __esModule: true,
  useCart: () => [[], mockSetCart],
}));

jest.mock("../../client/src/components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout-shell">{children}</div>,
}));

jest.mock("../../client/src/context/search", () => ({
  __esModule: true,
  useSearch: () => [
    {
      keyword: maliciousName,
      results: [
        {
          _id: "product-1",
          name: maliciousName,
          description: maliciousDescription,
          price: 99,
        },
      ],
    },
    jest.fn(),
  ],
}));

import Search from "../../client/src/pages/Search.js";
import HomePage from "../../client/src/pages/HomePage.js";

describe("XSS security testing", () => {
  beforeEach(() => {
    delete window.__xssAttack;
    jest.clearAllMocks();
  });

  test("search results render malicious product fields as inert text", () => {
    render(<Search />);

    expect(screen.getByTestId("layout-shell")).toBeInTheDocument();
    expect(screen.getByText(maliciousName)).toBeInTheDocument();
    expect(
      screen.getByText(`${maliciousDescription.substring(0, 30)}...`),
    ).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(window.__xssAttack).toBeUndefined();
  });

  test("malicious strings do not create extra actionable controls in the DOM", () => {
    render(<Search />);

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["More Details", "ADD TO CART"]);
    expect(
      screen.queryByText("window.__xssAttack = 'name'"),
    ).not.toBeInTheDocument();
    expect(window.__xssAttack).toBeUndefined();
  });

  test("home page product listings render malicious product fields as inert text", async () => {
    axios.get.mockImplementation((url) => {
      if (url === "/api/v1/category/get-category") {
        return Promise.resolve({ data: { success: true, category: [] } });
      }
      if (url === "/api/v1/product/product-count") {
        return Promise.resolve({ data: { total: 1 } });
      }
      if (url === "/api/v1/product/product-list/1") {
        return Promise.resolve({
          data: {
            products: [
              {
                _id: "listing-1",
                slug: "listing-1",
                name: maliciousName,
                description: maliciousDescription,
                price: 99,
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: {} });
    });

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(maliciousName)).toBeInTheDocument();
    });

    expect(screen.getByText(`${maliciousDescription}...`)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(window.__xssAttack).toBeUndefined();
  });
});
