/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * Integration tests for ProductDetails.js
 *
 * ProductDetails is the page that displays the full details of a single product.
 * It is reached via /product/:slug when More Details from CategoryProduct is clicked, showing the full product info.
 *
 * Integrated parts: ProductDetails, useParams, AuthContext, CartContext,
 *                   SearchContext, React Router navigation, Layout, Header, Footer
 * Mocked parts: axios (get-product, related-product, and get-category API calls)
 *
 * Test coverage
 * ─────────────
 * 1. API integration    : correct slug passed to get-product, related-product
 *                         called sequentially after get-product resolves
 * 2. Product details    : name, description, price (USD formatted), category,
 *                         ADD TO CART button renders (no onClick handler)
 * 3. Related products   : section heading, names, prices,
 *                         truncated descriptions, More Details button per card,
 *                         no Add to Cart on related cards
 * 4. Empty related      : "No Similar Products found" message displayed,
 *                         main product still renders correctly
 * 5. Navigation         : clicking More Details navigates to /product/:slug
 * 6. Error handling     : component does not crash when API call fails
 *
 * Note 1: Cart localStorage integration is NOT tested here because the ADD TO CART
 * button in the current implementation has no onClick handler. If cart
 * functionality is added in future, cart integration tests should be added then.
 *
 * Note 2: Add to Cart for related products is also NOT tested because it is
 * commented out in the source file.
 *
 * Note 3: mockImplementation is used instead of mockResolvedValue because
 * ProductDetails makes three different API calls (get-product, related-product,
 * and get-category for Header). mockImplementation lets us return different
 * responses based on the URL.
 * 
 * Test suite description is generated with reference to AI and edited.
 */
import React from "react";
import axios from "axios";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import ProductDetails from "./ProductDetails";

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

// product details page will be based on this product
const mockProduct = {
    _id: "p1",
    name: "product1",
    slug: "product1",
    description: "description for product1",
    price: 5,
    quantity: 5,
    category: mockCategory,
};

// related products of the mockProduct that belongs to the same category
const mockRelatedProducts = [
    {
        _id: "p2",
        name: "product2",
        slug: "product2",
        description: "description for product2",
        price: 10,
        quantity: 10,
        category: mockCategory,
    },
    {
        _id: "p3",
        name: "product3",
        slug: "product3",
        description: "description for product3",
        price: 15,
        quantity: 3,
        category: mockCategory,
    },
];

// axios mock helper to return different responses based on the URL called
const setupAxiosMock = (relatedProducts = mockRelatedProducts) => {
    axios.get.mockImplementation((url) => {
        if (url.includes("/api/v1/product/get-product/")) {
            return Promise.resolve({
                data: { success: true, product: mockProduct },
            });
        }
        // Called after get-product resolves, using product._id and category._id
        if (url.includes("/api/v1/product/related-product/")) {
            return Promise.resolve({
                data: { success: true, products: relatedProducts },
            });
        }
        // Categories endpoint called by useCategory inside Header
        if (url.includes("/api/v1/category/get-category")) {
            return Promise.resolve({
                data: { success: true, category: [mockCategory] },
            });
        }
        return Promise.resolve({ data: {} });
    });
};

// renders ProductDetails at /product/:slug with default mocked API responses.
const renderProductDetails = (slug = "product1") => {
    setupAxiosMock();

    return render(
        <MemoryRouter initialEntries={[`/product/${slug}`]}>
            <AuthProvider>
                <CartProvider>
                    <SearchProvider>
                        <Routes>
                            <Route path="/product/:slug" element={<ProductDetails />} />
                        </Routes>
                    </SearchProvider>
                </CartProvider>
            </AuthProvider>
        </MemoryRouter>
    );
};

// verify get-product and related-prodyct API is called using product's _id and category._id respectively
describe("API integration", () => {
    it("should call the get-product API with the correct slug from the URL", async () => {
        renderProductDetails("product1");

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                expect.stringContaining("/api/v1/product/get-product/product1")
            );
        });
    });

    // needs to be called sequentially after get-product
    it("should call the related-product API after fetching the main product", async () => {
        renderProductDetails("product1");

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                expect.stringContaining("/api/v1/product/related-product/")
            );
        });
    });
});

// verifies that the main product's data from the API response is correctly rendered on the page.
describe("Product card details display", () => {
    // helper function
    const getDetailsSection = () => document.querySelector(".product-details-info");

    it("should display the product name", async () => {
        renderProductDetails();

        await waitFor(() => {
            const section = getDetailsSection();
            expect(section).toBeInTheDocument();
            expect(section.textContent).toMatch(/Name\s*:\s*product1/);
        });
    });

    it("should display the product description", async () => {
        renderProductDetails();

        await waitFor(() => {
            const section = getDetailsSection();
            expect(section).toBeInTheDocument();
            expect(section.textContent).toMatch(/Description\s*:\s*description for product1/);
        });
    });

    it("should display the product price", async () => {
        renderProductDetails();

        await waitFor(() => {
            const section = getDetailsSection();
            expect(section).toBeInTheDocument();
            expect(section.textContent).toMatch(/Price\s*:\s*\$5\.00/);
        });
    });

    it("should display the product category", async () => {
        renderProductDetails();

        await waitFor(() => {
            const section = getDetailsSection();
            expect(section).toBeInTheDocument();
            expect(section.textContent).toMatch(/Category\s*:\s*cat1/);
        });
    });

    it("should render the 'ADD TO CART' button", async () => {
        renderProductDetails();

        await waitFor(() => {
            const section = getDetailsSection();
            expect(section).toBeInTheDocument();
            // Query the button within the details section specifically —
            // avoids matching any other buttons on the page
            const addToCartBtn = within(section).getByRole("button", {
                name: /add to cart/i,
            });
            expect(addToCartBtn).toBeInTheDocument();
        });
    });
});

// verifies related product cards are properly rendered
describe("Related products", () => {
    // helper to get queries to the similar products section,
    const getSimilarSection = () => document.querySelector(".similar-products");

    it("should display the 'Similar Products' section heading", async () => {
        renderProductDetails();

        await waitFor(() => {
            const section = getSimilarSection();
            expect(section).toBeInTheDocument();
            // Heading rendered as <h4>Similar Products ➡️</h4>
            // Use regex to handle any whitespace around the text
            expect(section.textContent).toMatch(/Similar Products/);
        });
    });

    it("should render all related product's name", async () => {
        renderProductDetails();

        await waitFor(() => {
            const section = getSimilarSection();
            expect(section).toBeInTheDocument();
            expect(within(section).getByText("product2")).toBeInTheDocument();
            expect(within(section).getByText("product3")).toBeInTheDocument();
        });
    });

    it("should render all related product's price", async () => {
        renderProductDetails();

        await waitFor(() => {
            const section = getSimilarSection();
            expect(section).toBeInTheDocument();
            expect(within(section).getByText("$10.00")).toBeInTheDocument();
            expect(within(section).getByText("$15.00")).toBeInTheDocument();
        });
    });

    it("should render a truncated description for all related products", async () => {
        renderProductDetails();

        await waitFor(() => {
            const section = getSimilarSection();
            expect(section).toBeInTheDocument();
            expect(section.textContent).toMatch(/description for product2\s*\.\.\./);
            expect(section.textContent).toMatch(/description for product3\s*\.\.\./);
        });
    });

    it("should render a More Details button for all related products", async () => {
        renderProductDetails();

        await waitFor(() => {
            const section = getSimilarSection();
            expect(section).toBeInTheDocument();

            const detailButtons = within(section).getAllByRole("button", {
                name: /more details/i,
            });
            // one button each, 2 products in the mock related products
            expect(detailButtons.length).toBeGreaterThanOrEqual(2);
        });
    });

    // add to cart should only exist in the main product's button.
    it("should NOT render Add to Cart buttons on related product cards", async () => {
        renderProductDetails();

        await waitFor(() => {
            const section = getSimilarSection();
            expect(section).toBeInTheDocument();
            // No Add to Cart buttons should exist inside the similar products section
            const cartButtons = within(section).queryAllByRole("button", {
                name: /add to cart/i,
            });
            expect(cartButtons).toHaveLength(0);
        });
    });
});

// verifies main product card still renders correctly is no similar products are found
describe("Empty related products", () => {
    it("should display 'No Similar Products found' when related products list is empty", async () => {
        setupAxiosMock([]);

        render(
            <MemoryRouter initialEntries={["/product/product1"]}>
                <AuthProvider>
                    <CartProvider>
                        <SearchProvider>
                            <Routes>
                                <Route path="/product/:slug" element={<ProductDetails />} />
                            </Routes>
                        </SearchProvider>
                    </CartProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            const section = document.querySelector(".similar-products");
            expect(section).toBeInTheDocument();
            // Rendered as <p class="text-center">No Similar Products found</p>
            // when relatedProducts.length < 1
            expect(within(section).getByText("No Similar Products found")).toBeInTheDocument();
        });
    });

    it("should still display the main product when no related products are returned", async () => {
        setupAxiosMock([]);

        render(
            <MemoryRouter initialEntries={["/product/product1"]}>
                <AuthProvider>
                    <CartProvider>
                        <SearchProvider>
                            <Routes>
                                <Route path="/product/:slug" element={<ProductDetails />} />
                            </Routes>
                        </SearchProvider>
                    </CartProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            // Scope main product assertions to .product-details-info
            const detailsSection = document.querySelector(".product-details-info");
            expect(detailsSection).toBeInTheDocument();
            expect(detailsSection.textContent).toMatch(/Name\s*:\s*product1/);
            expect(detailsSection.textContent).toMatch(/Price\s*:\s*\$5\.00/);
            expect(detailsSection.textContent).toMatch(/Category\s*:\s*cat1/);

            // Scope related product absence check to .similar-products
            const similarSection = document.querySelector(".similar-products");
            expect(similarSection).toBeInTheDocument();
            // product2 and product3 cards should not appear in the similar section
            expect(within(similarSection).queryByText("product2")).not.toBeInTheDocument();
            expect(within(similarSection).queryByText("product3")).not.toBeInTheDocument();
            // Empty message should appear instead
            expect(within(similarSection).getByText("No Similar Products found")).toBeInTheDocument();
        });
    });
});

// verifies that more details navigates to product details (dummy route used as destination)
describe("Navigation", () => {
    it("should navigate to the related product's page when More Details is clicked", async () => {
        setupAxiosMock();

        render(
            <MemoryRouter initialEntries={["/product/product1"]}>
                <AuthProvider>
                    <CartProvider>
                        <SearchProvider>
                            <Routes>
                                <Route path="/product/:slug" element={<ProductDetails />} />
                                    {/* Dummy destination — confirms navigation occurred */}
                                <Route
                                    path="/product/product2"
                                    element={<div>Related Product Page</div>}
                                />
                            </Routes>
                        </SearchProvider>
                    </CartProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        // Wait for related products to render before interacting
        await waitFor(() => {
            expect(screen.getByText("product2")).toBeInTheDocument();
        });

        const detailButtons = screen.getAllByRole("button", { name: /more details/i });

        // Click More Details for the first related product (product2)
        fireEvent.click(detailButtons[0]);

        // Dummy destination element appears, confirming React Router changed the route
        await waitFor(() => {
            expect(screen.getByText("Related Product Page")).toBeInTheDocument();
        });
    });
});

// verifies defensive bahavior such that failed API call wont crash the component
describe("Error handling", () => {
    it("should not crash when the get-product API call fails", async () => {
        axios.get.mockRejectedValue(new Error("Network Error"));

        expect(() => {
            render(
                <MemoryRouter initialEntries={["/product/product1"]}>
                    <AuthProvider>
                        <CartProvider>
                            <SearchProvider>
                                <Routes>
                                    <Route
                                        path="/product/:slug"
                                        element={<ProductDetails />}
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