// A0272558U Teo Kai Xiang
// Written by GPT 5.4 based on test plans written by me. Reviewed after
// Integration Between: Home <-> Category <-> Cart <-> Header
// ============= Full list of tests =============
// Happy path
// 1. Applies a category filter and updates the product list.
// 2. Applies a price filter and updates the product list.
// 3. Applies category and price filters together and keeps only the matching results.
// 4. Clears an unselected category filter without leaving stale filtered products behind.
// 5. Adds a product to cart and syncs cart context plus localStorage.-
// 6. Loads more unfiltered products and appends page 2 results.
// 7. Keeps category and price filters fixed when loading more filtered products.
//
// Negative path
// 8. Renders an empty result set gracefully when a category and price combination matches nothing.

import React from "react";
import axios from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";

import HomePage from "../../../client/src/pages/HomePage";
import CartPage from "../../../client/src/pages/CartPage";
import { AuthProvider } from "../../../client/src/context/auth";
import { CartProvider, useCart } from "../../../client/src/context/cart";
import { SearchProvider } from "../../../client/src/context/search";

var mockToastSuccess = jest.fn();

jest.mock("axios");
jest.mock(
  "braintree-web-drop-in-react",
  () => () => <div data-testid="dropin" />,
  { virtual: true },
);

const CATEGORY_ID = "cat-electronics";
const FILTER_URL = "/api/v1/product/product-filters";
const PRICE_RANGE = [20, 39];

const categories = [
  { _id: CATEGORY_ID, name: "Electronics", slug: "electronics" },
  { _id: "cat-books", name: "Books", slug: "books" },
];

const initialProducts = [
  {
    _id: "prod-book",
    name: "Mystery Paperback",
    slug: "mystery-paperback",
    description: "A page-turning paperback mystery for weekend reading.",
    price: 15,
  },
  {
    _id: "prod-monitor",
    name: "Studio Monitor",
    slug: "studio-monitor",
    description: "A compact desktop monitor for gaming and creative work.",
    price: 89,
  },
];

const categoryFilteredProducts = [
  initialProducts[1],
  {
    _id: "prod-dac",
    name: "Pocket DAC",
    slug: "pocket-dac",
    description: "A portable USB DAC that improves audio on the go.",
    price: 25,
  },
];

const priceFilteredProducts = [
  {
    _id: "prod-dac",
    name: "Pocket DAC",
    slug: "pocket-dac",
    description: "A portable USB DAC that improves audio on the go.",
    price: 25,
  },
  {
    _id: "prod-charger",
    name: "Portable Charger",
    slug: "portable-charger",
    description: "A slim charger that keeps your devices alive all day.",
    price: 35,
  },
];

const combinedFilteredProductsPageOne = [priceFilteredProducts[0]];
const combinedFilteredProductsPageTwo = [priceFilteredProducts[1]];

const pageTwoProducts = [priceFilteredProducts[1]];
const electronicsCategory = categories[0];
const booksCategory = categories[1];
const mysteryPaperbackProduct = initialProducts[0];
const studioMonitorProduct = initialProducts[1];
const pocketDacProduct = categoryFilteredProducts[1];
const portableChargerProduct = priceFilteredProducts[1];
const allKnownProducts = [
  mysteryPaperbackProduct,
  studioMonitorProduct,
  pocketDacProduct,
  portableChargerProduct,
];

const buildFilterPayload = ({ checked = [], radio = [], page = 1 } = {}) => ({
  checked,
  radio,
  page,
});

const buildFilterKey = (payload) => JSON.stringify(buildFilterPayload(payload));
const getProductNames = (products) => products.map((product) => product.name);
const getCartPriceLabel = (product) => `Price : ${product.price}`;

const defaultFilterResponses = {
  [buildFilterKey({ checked: [CATEGORY_ID] })]: {
    products: categoryFilteredProducts,
    total: categoryFilteredProducts.length,
  },
  [buildFilterKey({ radio: PRICE_RANGE })]: {
    products: priceFilteredProducts,
    total: priceFilteredProducts.length,
  },
  [buildFilterKey({ checked: [CATEGORY_ID], radio: PRICE_RANGE })]:
    {
      products: combinedFilteredProductsPageOne,
      total:
        combinedFilteredProductsPageOne.length +
        combinedFilteredProductsPageTwo.length,
    },
  [buildFilterKey({ checked: [CATEGORY_ID], radio: PRICE_RANGE, page: 2 })]:
    {
      products: combinedFilteredProductsPageTwo,
      total:
        combinedFilteredProductsPageOne.length +
        combinedFilteredProductsPageTwo.length,
    },
};

const CartStateProbe = () => {
  const [cart] = useCart();

  return <div data-testid="cart-context-count">{cart.length}</div>;
};

const renderHomePage = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <CartProvider>
          <SearchProvider>
            <CartStateProbe />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/product/:slug" element={<div>Product details</div>} />
            </Routes>
          </SearchProvider>
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

const setupHttpMocks = ({
  total = 3,
  productListPageOne = initialProducts,
  productListPageTwo = pageTwoProducts,
  filterResponses = {},
} = {}) => {
  const mergedFilterResponses = {
    ...defaultFilterResponses,
    ...filterResponses,
  };

  axios.get.mockImplementation((url) => {
    switch (url) {
      case "/api/v1/category/get-category":
        return Promise.resolve({
          data: { success: true, category: categories },
        });
      case "/api/v1/product/braintree/token":
        return Promise.resolve({
          data: { clientToken: "test-client-token" },
        });
      case "/api/v1/product/product-count":
        return Promise.resolve({
          data: { total },
        });
      case "/api/v1/product/product-list/1":
        return Promise.resolve({
          data: { products: productListPageOne },
        });
      case "/api/v1/product/product-list/2":
        return Promise.resolve({
          data: { products: productListPageTwo },
        });
      default:
        return Promise.reject(new Error(`Unhandled GET request: ${url}`));
    }
  });

  axios.post.mockImplementation((url, payload) => {
    if (url !== FILTER_URL) {
      return Promise.reject(new Error(`Unhandled POST request: ${url}`));
    }

    const response = mergedFilterResponses[buildFilterKey(payload)];
    if (!response) {
      return Promise.reject(
        new Error(`Unhandled filter payload: ${JSON.stringify(payload)}`),
      );
    }

    return Promise.resolve({
      data: response,
    });
  });
};

const waitForInitialHomeLoad = async () => {
  renderHomePage();
  await screen.findByRole("heading", { name: /all products/i });

  await waitFor(() => {
    expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
    expect(axios.get).toHaveBeenCalledWith("/api/v1/product/product-count");
    expect(axios.get).toHaveBeenCalledWith("/api/v1/product/product-list/1");
    expect(
      screen.getByRole("checkbox", { name: electronicsCategory.name }),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: booksCategory.name })).toBeInTheDocument();
    expect(screen.getByText(mysteryPaperbackProduct.name)).toBeInTheDocument();
    expect(screen.getByText(studioMonitorProduct.name)).toBeInTheDocument();
  });
};

const expectVisibleProducts = async (visibleProducts, hiddenProducts = []) => {
  await waitFor(() => {
    visibleProducts.forEach((productName) => {
      expect(screen.getByText(productName)).toBeInTheDocument();
    });

    hiddenProducts.forEach((productName) => {
      expect(screen.queryByText(productName)).not.toBeInTheDocument();
    });
  });
};

const getAddToCartButtonForProduct = (productName) => {
  const productCard = screen.getByText(productName).closest(".card");

  expect(productCard).not.toBeNull();

  return within(productCard).getByRole("button", {
    name: /add to cart/i,
  });
};

describe("[Integration] Home shopper flows", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(() => {
    axios.get.mockReset();
    axios.post.mockReset();
    axios.defaults = { headers: { common: {} } };
    localStorage.clear();
    mockToastSuccess.mockClear();
    toast.success = mockToastSuccess;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("Happy path", () => {
    it("applies a category filter and updates the product list", async () => {
      setupHttpMocks();

      // Arrange
      await waitForInitialHomeLoad();
      const electronicsCheckbox = screen.getByRole("checkbox", {
        name: electronicsCategory.name,
      });

      // Act
      await userEvent.click(electronicsCheckbox);

      // Assert
      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(FILTER_URL, {
          checked: [CATEGORY_ID],
          radio: [],
          page: 1,
        });
      });

      await expectVisibleProducts(
        getProductNames(categoryFilteredProducts),
        getProductNames([mysteryPaperbackProduct]),
      );
    });

    it("applies a price filter and updates the product list", async () => {
      setupHttpMocks();

      // Arrange
      await waitForInitialHomeLoad();
      const priceRadio = screen.getByRole("radio", {
        name: "$20 to 39",
      });

      // Act
      await userEvent.click(priceRadio);

      // Assert
      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(FILTER_URL, {
          checked: [],
          radio: PRICE_RANGE,
          page: 1,
        });
      });

      await expectVisibleProducts(
        getProductNames(priceFilteredProducts),
        getProductNames(initialProducts),
      );
    });

    it("applies category and price filters together and keeps only the matching results", async () => {
      setupHttpMocks();

      // Arrange
      await waitForInitialHomeLoad();
      const electronicsCheckbox = screen.getByRole("checkbox", {
        name: electronicsCategory.name,
      });
      const priceRadio = screen.getByRole("radio", {
        name: "$20 to 39",
      });

      // Act
      await userEvent.click(electronicsCheckbox);
      await userEvent.click(priceRadio);

      // Assert
      await waitFor(() => {
        expect(axios.post).toHaveBeenLastCalledWith(FILTER_URL, {
          checked: [CATEGORY_ID],
          radio: PRICE_RANGE,
          page: 1,
        });
      });

      await expectVisibleProducts(
        getProductNames(combinedFilteredProductsPageOne),
        getProductNames([
          mysteryPaperbackProduct,
          studioMonitorProduct,
          portableChargerProduct,
        ]),
      );
    });

    it("clears an selected category filter without leaving stale filtered products behind", async () => {
      setupHttpMocks();

      // Arrange
      await waitForInitialHomeLoad();
      const electronicsCheckbox = screen.getByRole("checkbox", {
        name: electronicsCategory.name,
      });

      // Act
      await userEvent.click(electronicsCheckbox);

      // Assert
      await expectVisibleProducts(
        getProductNames(categoryFilteredProducts),
        getProductNames([mysteryPaperbackProduct]),
      );

      // Act
      await userEvent.click(electronicsCheckbox);

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenLastCalledWith("/api/v1/product/product-list/1");
      });

      await expectVisibleProducts(
        getProductNames(initialProducts),
        getProductNames([pocketDacProduct]),
      );
    });

    it("adds a product to cart and syncs cart context plus localStorage", async () => {
      setupHttpMocks();

      // Arrange
      await waitForInitialHomeLoad();
      const addToCartButton = getAddToCartButtonForProduct(
        mysteryPaperbackProduct.name,
      );

      // Act
      await userEvent.click(addToCartButton);

      // Assert
      await waitFor(() => {
        const cartBadge = document.querySelector("sup.ant-badge-count");

        expect(screen.getByTestId("cart-context-count")).toHaveTextContent("1");
        expect(cartBadge).toBeInTheDocument();
        expect(cartBadge).toHaveAttribute("title", "1");
        expect(JSON.parse(localStorage.getItem("cart"))).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              _id: mysteryPaperbackProduct._id,
              name: mysteryPaperbackProduct.name,
            }),
          ]),
        );
        expect(mockToastSuccess).toHaveBeenCalledWith("Item Added to cart");
      });
    });

    it("opens the cart page from the header and shows the correct cart item", async () => {
      setupHttpMocks();

      // Arrange
      await waitForInitialHomeLoad();
      const addToCartButton = getAddToCartButtonForProduct(
        mysteryPaperbackProduct.name,
      );

      // Act
      await userEvent.click(addToCartButton);
      await userEvent.click(screen.getByRole("link", { name: /cart/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /cart summary/i })).toBeInTheDocument();
        expect(screen.getByText(mysteryPaperbackProduct.name)).toBeInTheDocument();
        expect(
          screen.getByText(getCartPriceLabel(mysteryPaperbackProduct)),
        ).toBeInTheDocument();
        expect(screen.getByText(/You Have 1 items in your cart/i)).toBeInTheDocument();
        expect(screen.queryByText(studioMonitorProduct.name)).not.toBeInTheDocument();
      });
    });

    it("loads more unfiltered products and appends page 2 results", async () => {
      setupHttpMocks();

      // Arrange
      await waitForInitialHomeLoad();
      const loadMoreButton = screen.getByRole("button", { name: /loadmore/i });

      // Act
      await userEvent.click(loadMoreButton);

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith("/api/v1/product/product-list/2");
      });

      await expectVisibleProducts([
        ...getProductNames(initialProducts),
        portableChargerProduct.name,
      ]);
    });

    it("keeps category and price filters fixed when loading more filtered products", async () => {
      setupHttpMocks();

      // Arrange
      await waitForInitialHomeLoad();
      const electronicsCheckbox = screen.getByRole("checkbox", {
        name: electronicsCategory.name,
      });
      const priceRadio = screen.getByRole("radio", {
        name: "$20 to 39",
      });

      // Act
      await userEvent.click(electronicsCheckbox);
      await userEvent.click(priceRadio);

      // Arrange
      const loadMoreButton = await screen.findByRole("button", {
        name: /loadmore/i,
      });

      // Act
      await userEvent.click(loadMoreButton);

      // Assert
      await waitFor(() => {
        expect(axios.post).toHaveBeenLastCalledWith(FILTER_URL, {
          checked: [CATEGORY_ID],
          radio: PRICE_RANGE,
          page: 2,
        });
      });

      await expectVisibleProducts(
        getProductNames([
          ...combinedFilteredProductsPageOne,
          ...combinedFilteredProductsPageTwo,
        ]),
        getProductNames(initialProducts),
      );
    });
  });

  describe("Negative path", () => {
    it("renders an empty result set gracefully when a category and price combination matches nothing", async () => {
      setupHttpMocks({
        filterResponses: {
          [buildFilterKey({ checked: [CATEGORY_ID], radio: PRICE_RANGE })]: {
            products: [],
            total: 0,
          },
        },
      });

      // Arrange
      await waitForInitialHomeLoad();
      const electronicsCheckbox = screen.getByRole("checkbox", {
        name: electronicsCategory.name,
      });
      const priceRadio = screen.getByRole("radio", {
        name: "$20 to 39",
      });

      // Act
      await userEvent.click(electronicsCheckbox);
      await userEvent.click(priceRadio);

      // Assert
      await waitFor(() => {
        expect(axios.post).toHaveBeenLastCalledWith(FILTER_URL, {
          checked: [CATEGORY_ID],
          radio: PRICE_RANGE,
          page: 1,
        });
        expect(
          screen.queryByRole("button", { name: /add to cart/i }),
        ).not.toBeInTheDocument();
      });

      await expectVisibleProducts([], getProductNames(allKnownProducts));

      expect(screen.getByRole("heading", { name: /all products/i })).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: electronicsCategory.name }),
      ).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "$20 to 39" })).toBeInTheDocument();
    });
  });
});
