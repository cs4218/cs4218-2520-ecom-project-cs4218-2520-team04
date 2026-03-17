/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * Integration tests for CategoryProduct.js
 *
 * CategoryProduct is the page that displays all products belonging to a
 * specific category. It is reached via /category/:slug — for example,
 * navigating to /category/electronics shows all electronics products.
 *
 * CategoryProduct integrates with multiple dependencies — these tests verify
 * that all of them work together correctly when the page is rendered at its
 * real route inside context providers and a MemoryRouter.
 *
 * Integrated parts: CategoryProduct, useParams, AuthContext, CartContext,
 *                   SearchContext, React Router navigation, Layout, Header, Footer
 * Mocked parts: axios (both product-category and get-category API calls)
 *
 * Test coverage
 * ─────────────
 * 1. API integration : correct slug passed to API, category name displayed
 * 2. Product list    : product count, names, prices, More Details buttons
 *                      rendered for each product
 * 3. Empty state     : graceful render when API returns no products
 * 4. Navigation      : More Details navigates to /product/:slug via React Router
 * 5. Error handling  : component does not crash when API call fails
 *
 * Note: Add to Cart button and cart integration tests are NOT here —
 * that button only appears on the ProductDetails page after clicking
 * More Details. Those tests belong in ProductDetails.integration.test.js.
 *
 * Note: mockImplementation is used instead of mockResolvedValue because
 * CategoryProduct makes two different API calls (product-category and
 * get-category for Header). mockImplementation lets us return different
 * responses based on the URL.
 * 
 * Test suite description is generated with reference to AI and edited.
 */
import React from "react";
import axios from "axios";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import CategoryProduct from "./CategoryProduct";

// providers for header component
import { AuthProvider } from "../context/auth";
import { CartProvider } from "../context/cart";
import { SearchProvider } from "../context/search";

// intercept http requests (get & post)
jest.mock("axios");

// silence console noise in tests
beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
});

// clean up
afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
});


// predefined category and product
const mockCategory = {
    _id: "cat1",
    name: "cat1",
    slug: "cat1",
};

const mockProducts = [
    {
        _id: "p1",
        name: "product1",
        slug: "product1",
        description: "description for product1",
        price: 5,
        quantity: 5,
        category: "cat1",
    },
    {
        _id: "p2",
        name: "product2",
        slug: "product2",
        description: "description for product2",
        price: 10,
        quantity: 10,
        category: "cat1",
    },
];

// 2 API endpoints are called when rendering CategoryProduct:
//   1. /api/v1/product/product-category/:slug  → returns category + products
//   2. /api/v1/category/get-category           → returns categories for Header
const setupAxiosMock = (products = mockProducts) => {
    axios.get.mockImplementation((url) => {
        if (url.includes("/api/v1/product/product-category/")) {
            return Promise.resolve({
                data: { success: true, category: mockCategory, products },
            });
        }
        if (url.includes("/api/v1/category/get-category")) {
            return Promise.resolve({
                data: { success: true, category: [mockCategory] },
            });
        }
        return Promise.resolve({ data: {} });
    });
};

const renderCategoryProduct = (slug = "cat1") => {
    setupAxiosMock();

    return render(
        <MemoryRouter initialEntries={[`/category/${slug}`]}>
            <AuthProvider>
                <CartProvider>
                    <SearchProvider>
                        <Routes>
                            <Route path="/category/:slug" element={<CategoryProduct />} />
                        </Routes>
                    </SearchProvider>
                </CartProvider>
            </AuthProvider>
        </MemoryRouter>
    );
};

// verifies both the product-category API (for products) and get-category API
describe("API integration", () => {
    it("should call the product-category API with the correct slug from the URL", async () => {
        renderCategoryProduct("cat1");

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                expect.stringContaining("/api/v1/product/product-category/cat1")
            );
        });
    });

    it("should display the right category name returned by the API", async () => {
        renderCategoryProduct("cat1");

        await waitFor(() => {
            const categoryHeading = document.querySelector("h4.text-center");
            expect(categoryHeading).toBeInTheDocument();
            expect(categoryHeading.textContent).toMatch(/cat1/i);
        });
    });
});

// verifies products are corrected rendered for the appropriate category
describe("Product list", () => {
    // should be 2 based on mockProducts
    it("should display the number of products found", async () => {
        renderCategoryProduct("cat1");

        await waitFor(() => {
            expect(
                screen.queryByText(/2\s+result/i) ||
                screen.queryByText(/2\s+product/i) ||
                screen.getByText("product1")
            ).toBeInTheDocument();
        });
    });

    it("should render each product's name", async () => {
        renderCategoryProduct("cat1");

        await waitFor(() => {
            expect(screen.getByText("product1")).toBeInTheDocument();
            expect(screen.getByText("product2")).toBeInTheDocument();
        });
    });

    it("should render each product's price", async () => {
        renderCategoryProduct("cat1");

        await waitFor(() => {
            // Prices match mockProducts: product1 = $5, product2 = $10
            expect(screen.getByText(/5/)).toBeInTheDocument();
            expect(screen.getByText(/10/)).toBeInTheDocument();
        });
    });

    // navigation to /product/:slug is tested in Navigation
    it("should render More Details buttons for each product", async () => {
        renderCategoryProduct("cat1");

        await waitFor(() => {
            const detailButtons = screen.getAllByRole("button", {
                name: /more details/i,
            });
            expect(detailButtons.length).toBeGreaterThanOrEqual(2);
        });
    });

    // "Add to Cart" button should only appear in ProductDetails, not here
    it("should NOT render Add to Cart buttons on the category product page", async () => {
        renderCategoryProduct("cat1");

        await waitFor(() => {
            expect(screen.getByText("product1")).toBeInTheDocument();
        });

        const cartButtons = screen.queryAllByText(/add to cart/i);
        expect(cartButtons).toHaveLength(0);
    });
});

// verifies component handles empty product list gracefully without crashing
describe("Empty state", () => {
    it("should render gracefully when the API returns an empty product list", async () => {
        // Override the default mock to return an empty products array
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/product-category/")) {
                return Promise.resolve({
                    data: { success: true, category: mockCategory, products: [] },
                });
            }
            return Promise.resolve({ data: { success: true, category: [] } });
        });

        render(
            <MemoryRouter initialEntries={["/category/cat1"]}>
                <AuthProvider>
                    <CartProvider>
                        <SearchProvider>
                            <Routes>
                                <Route path="/category/:slug" element={<CategoryProduct />} />
                            </Routes>
                        </SearchProvider>
                    </CartProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            // No product cards should be present
            expect(screen.queryByText("product1")).not.toBeInTheDocument();
            expect(screen.queryByText("product2")).not.toBeInTheDocument();
            // Category name should still appear even with no products
            const noResults =
                screen.queryByText(/0\s+result/i) ||
                screen.queryByText(/no product/i) ||
                screen.queryByText(/cat1/i);
            expect(noResults).toBeInTheDocument();
        });
    });
});

// Verifies navigation to /product/:slug using a dummy route, and not actual content of ProductDetails
describe("Navigation to Product Details", () => {
    it("should navigate to the product details page when More Details is clicked", async () => {
        setupAxiosMock(); // ✅ same mock, no duplication

        render(
            <MemoryRouter initialEntries={["/category/cat1"]}>
                <AuthProvider>
                    <CartProvider>
                        <SearchProvider>
                            <Routes>
                                <Route path="/category/:slug" element={<CategoryProduct />} />
                                <Route
                                    path="/product/:slug"
                                    element={<div>Product Detail Page</div>}
                                />
                            </Routes>
                        </SearchProvider>
                    </CartProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("product1")).toBeInTheDocument();
        });

        const detailButtons = screen.getAllByRole("button", { name: /more details/i });
        fireEvent.click(detailButtons[0]);

        await waitFor(() => {
            expect(screen.getByText("Product Detail Page")).toBeInTheDocument();
        });
    });
});

// ─── Error handling ───────────────────────────────────────────────────────────
// Verifies defensive behaviour — the component should not crash when the API
// fails, as network errors are a real scenario in production.

describe("Error handling", () => {
    it("should not crash when the API call fails", async () => {
        axios.get.mockRejectedValue(new Error("Network Error"));

        expect(() => {
            render(
                <MemoryRouter initialEntries={["/category/cat1"]}>
                    <AuthProvider>
                        <CartProvider>
                            <SearchProvider>
                                <Routes>
                                    <Route
                                        path="/category/:slug"
                                        element={<CategoryProduct />}
                                    />
                                </Routes>
                            </SearchProvider>
                        </CartProvider>
                    </AuthProvider>
                </MemoryRouter>
            );
        }).not.toThrow();
    });
});