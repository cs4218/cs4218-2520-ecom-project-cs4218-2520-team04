// Teo Kai Xiang, A0272558U
// Initial test template + mock helpers were written by me. Additional tests were generated and reviewed by GPT-5.3-Codex

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import HomePage from "./HomePage";
import { mockAxiosByUrl, mockAxiosByUrlWithError } from "../mocks/mockAxios";

const TITLE_TEXT = "All Products";
const PRODUCTS = [
  {
    _id: "p1",
    name: "Test Product",
    slug: "test-product",
    description: "A sample product description for testing",
    price: 12,
  },
  {
    _id: "p2",
    name: "Test Product2",
    slug: "test-product2",
    description: "A sample product description for testing2",
    price: 15,
  },
];
const FILTER_URL = "/api/v1/product/product-filters";
const CATEGORY_ONE = { _id: "c1", name: "Electronics" };
const CATEGORY_TWO = { _id: "c2", name: "Books" };
const CATEGORIES = [CATEGORY_ONE, CATEGORY_TWO];
const HAPPY_PATH_RESPONSES = {
  "/api/v1/category/get-category": {
    data: { success: true, category: [] },
  },
  "/api/v1/product/product-count": { data: { total: 2 } },
  "/api/v1/product/product-list/1": {
    data: {
      products: PRODUCTS,
    },
  },
};

const HAPPY_PATH_RESPONSES_EMPTY = {
  "/api/v1/category/get-category": {
    data: { success: true, category: [] },
  },
  "/api/v1/product/product-count": { data: { total: 0 } },
  "/api/v1/product/product-list/1": {
    data: {
      products: [],
    },
  },
};

const ERROR_RESPONSES = {
  "/api/v1/category/get-category": {
    response: {
      status: 500,
      data: { success: false, message: "Error while getting all categories" },
    },
    message: "Request failed with status code 500",
  },
  "/api/v1/product/product-count": {
    response: {
      status: 400,
      data: { success: false, message: "Error in product count" },
    },
    message: "Request failed with status code 400",
  },
  "/api/v1/product/product-list/1": {
    response: {
      status: 400,
      data: { success: false, message: "error in per page ctrl" },
    },
    message: "Request failed with status code 400",
  },
};

jest.mock("axios");

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
}));

jest.mock("./../components/Layout", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));

jest.mock("../context/cart", () => ({
  useCart: () => [[], jest.fn()],
}));

describe("HomePage Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Happy Path Tests - when everything works as expected, the component", () => {
    it("renders products returned from product list API on initial load", async () => {
      // We mock the URL implementation instead as useEffect() means the order of API calls is not guaranteed, so we need to handle all possible calls in our mock implementation.
      // ------------ Arrange ------------
      mockAxiosByUrl(axios.get, HAPPY_PATH_RESPONSES);

      // Check React Functional Component actually renders - we will test it more completely in UI testing
      // ------------ Act ------------
      render(<HomePage />);

      // ------------ Assert ------------
      await waitFor(() => {
        expect(screen.getByText(TITLE_TEXT)).toBeInTheDocument();
      });

      // Ensure all expected product data is rendered on the page
      await waitFor(() => {
        PRODUCTS.forEach((product) => {
          expect(screen.getByText(product.name)).toBeInTheDocument();
        });
      });

      // Ensures all URLs are called
      Object.keys(HAPPY_PATH_RESPONSES).forEach((url) => {
        expect(axios.get).toHaveBeenCalledWith(url);
      });
    });

    it("renders HomePage as usual when no products are listed", async () => {
      // We mock the URL implementation instead as useEffect() means the order of API calls is not guaranteed, so we need to handle all possible calls in our mock implementation.
      // ------------ Arrange ------------
      mockAxiosByUrl(axios.get, HAPPY_PATH_RESPONSES_EMPTY);

      // Check React Functional Component actually renders - we will test it more completely in UI testing
      // ------------ Act ------------
      render(<HomePage />);

      // ------------ Assert ------------
      await waitFor(() => {
        expect(screen.getByText(TITLE_TEXT)).toBeInTheDocument();
      });

      // Ensures all URLs are called
      Object.keys(HAPPY_PATH_RESPONSES_EMPTY).forEach((url) => {
        expect(axios.get).toHaveBeenCalledWith(url);
      });
    });

    it("renders category checkboxes when category API succeeds", async () => {
      // ------------ Arrange ------------
      const responses = {
        "/api/v1/category/get-category": {
          data: { success: true, category: CATEGORIES },
        },
        "/api/v1/product/product-count": { data: { total: PRODUCTS.length } },
        "/api/v1/product/product-list/1": {
          data: { products: PRODUCTS },
        },
      };
      mockAxiosByUrl(axios.get, responses);

      // ------------ Act ------------
      render(<HomePage />);

      // ------------ Assert ------------
      await waitFor(() => {
        expect(
          screen.getByRole("checkbox", { name: CATEGORY_ONE.name }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("checkbox", { name: CATEGORY_TWO.name }),
        ).toBeInTheDocument();
      });
      expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
    });

    it("calls filter API with selected radio range when a price option is clicked", async () => {
      // ------------ Arrange ------------
      const responses = {
        "/api/v1/category/get-category": {
          data: { success: true, category: [] },
        },
        "/api/v1/product/product-count": { data: { total: PRODUCTS.length } },
        "/api/v1/product/product-list/1": {
          data: { products: PRODUCTS },
        },
      };
      mockAxiosByUrl(axios.get, responses);
      mockAxiosByUrl(axios.post, {
        [FILTER_URL]: { data: { products: PRODUCTS } },
      });

      // ------------ Act ------------
      render(<HomePage />);
      const priceOption = await screen.findByRole("radio", {
        name: "$20 to 39",
      });
      fireEvent.click(priceOption);

      // ------------ Assert ------------
      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(FILTER_URL, {
          checked: [],
          page: 1,
          radio: [20, 39],
        });
      });
    });

    it("calls filter API with selected category when a category checkbox is clicked", async () => {
      // ------------ Arrange ------------
      const responses = {
        "/api/v1/category/get-category": {
          data: { success: true, category: CATEGORIES },
        },
        "/api/v1/product/product-count": { data: { total: PRODUCTS.length } },
        "/api/v1/product/product-list/1": {
          data: { products: PRODUCTS },
        },
      };
      mockAxiosByUrl(axios.get, responses);
      mockAxiosByUrl(axios.post, {
        [FILTER_URL]: { data: { products: PRODUCTS } },
      });

      // ------------ Act ------------
      render(<HomePage />);
      const categoryCheckbox = await screen.findByRole("checkbox", {
        name: CATEGORY_ONE.name,
      });
      fireEvent.click(categoryCheckbox);

      // ------------ Assert ------------
      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(FILTER_URL, {
          checked: [CATEGORY_ONE._id],
          page: 1,
          radio: [],
        });
      });
    });

    it("removes unchecked category id from filter payload while preserving selected price filter", async () => {
      // ------------ Arrange ------------
      const responses = {
        "/api/v1/category/get-category": {
          data: { success: true, category: CATEGORIES },
        },
        "/api/v1/product/product-count": { data: { total: PRODUCTS.length } },
        "/api/v1/product/product-list/1": {
          data: { products: PRODUCTS },
        },
      };
      mockAxiosByUrl(axios.get, responses);
      mockAxiosByUrl(axios.post, {
        [FILTER_URL]: { data: { products: PRODUCTS } },
      });

      // ------------ Act ------------
      render(<HomePage />);
      const priceOption = await screen.findByRole("radio", {
        name: "$20 to 39",
      });
      fireEvent.click(priceOption);

      const categoryCheckbox = await screen.findByRole("checkbox", {
        name: CATEGORY_ONE.name,
      });
      fireEvent.click(categoryCheckbox);
      fireEvent.click(categoryCheckbox);

      // ------------ Assert ------------
      await waitFor(() => {
        expect(axios.post).toHaveBeenLastCalledWith(FILTER_URL, {
          checked: [],
          page: 1,
          radio: [20, 39],
        });
      });
    });

    it("uses product-list endpoint and does not call filter API when no filters are selected", async () => {
      // ------------ Arrange ------------
      const responses = {
        "/api/v1/category/get-category": {
          data: { success: true, category: CATEGORIES },
        },
        "/api/v1/product/product-count": { data: { total: PRODUCTS.length } },
        "/api/v1/product/product-list/1": {
          data: { products: PRODUCTS },
        },
      };
      mockAxiosByUrl(axios.get, responses);

      // ------------ Act ------------
      render(<HomePage />);

      // ------------ Assert ------------
      await waitFor(() => {
        expect(screen.getByText(PRODUCTS[0].name)).toBeInTheDocument();
      });
      expect(axios.get).toHaveBeenCalledWith("/api/v1/product/product-list/1");
      expect(axios.post).not.toHaveBeenCalled();
    });

    it("loads next page of products when Loadmore button is clicked and more products exist", async () => {
      // ------------ Arrange ------------
      const nextPageProducts = [
        {
          _id: "p3",
          name: "Page 2 Product",
          slug: "page-2-product",
          description: "A second page product description",
          price: 19,
        },
      ];
      const responses = {
        "/api/v1/category/get-category": {
          data: { success: true, category: [] },
        },
        "/api/v1/product/product-count": { data: { total: 2 } },
        "/api/v1/product/product-list/1": {
          data: { products: [PRODUCTS[0]] },
        },
        "/api/v1/product/product-list/2": {
          data: { products: nextPageProducts },
        },
      };
      mockAxiosByUrl(axios.get, responses);

      // ------------ Act ------------
      render(<HomePage />);
      const loadMoreButton = await screen.findByRole("button", {
        name: /loadmore/i,
      });
      fireEvent.click(loadMoreButton);

      // ------------ Assert ------------
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          "/api/v1/product/product-list/2",
        );
      });
      await waitFor(() => {
        expect(screen.getByText("Page 2 Product")).toBeInTheDocument();
      });
    });

    it("hides Loadmore button when all products are already loaded", async () => {
      // ------------ Arrange ------------
      const responses = {
        "/api/v1/category/get-category": {
          data: { success: true, category: [] },
        },
        "/api/v1/product/product-count": { data: { total: PRODUCTS.length } },
        "/api/v1/product/product-list/1": {
          data: { products: PRODUCTS },
        },
      };
      mockAxiosByUrl(axios.get, responses);

      // ------------ Act ------------
      render(<HomePage />);

      // ------------ Assert ------------
      await waitFor(() => {
        expect(screen.getByText(PRODUCTS[0].name)).toBeInTheDocument();
      });
      expect(
        screen.queryByRole("button", { name: /loadmore/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Unhappy Path Tests - when something breaks, the component", () => {
    it("handles API errors gracefully and does not crash the component", async () => {
      // ------------ Arrange ------------
      mockAxiosByUrlWithError(axios.get, ERROR_RESPONSES);

      // Check React Functional Component actually renders - we will test it more completely in UI testing
      // ------------ Act ------------
      render(<HomePage />);

      // ------------ Assert ------------
      await waitFor(() => {
        expect(screen.getByText(TITLE_TEXT)).toBeInTheDocument();
      });

      // Ensures all URLs are called
      Object.keys(ERROR_RESPONSES).forEach((url) => {
        expect(axios.get).toHaveBeenCalledWith(url);
      });
    });

    it("does not render category checkboxes when category API returns success false", async () => {
      // ------------ Arrange ------------
      const responses = {
        "/api/v1/category/get-category": {
          data: { success: false, category: CATEGORIES },
        },
        "/api/v1/product/product-count": { data: { total: PRODUCTS.length } },
        "/api/v1/product/product-list/1": {
          data: { products: PRODUCTS },
        },
      };
      mockAxiosByUrl(axios.get, responses);

      // ------------ Act ------------
      render(<HomePage />);

      // ------------ Assert ------------
      await waitFor(() => {
        expect(screen.getByText(TITLE_TEXT)).toBeInTheDocument();
      });
      expect(
        screen.queryByRole("checkbox", { name: CATEGORY_ONE.name }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("checkbox", { name: CATEGORY_TWO.name }),
      ).not.toBeInTheDocument();
    });
  });
});
