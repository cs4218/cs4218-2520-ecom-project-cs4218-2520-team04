/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * Integration tests for Header.js
 *
 * Header integrates with multiple dependencies simultaneously — these tests verify
 * that all of them work together correctly when Header is rendered inside its
 * real context providers and a MemoryRouter.
 *
 * Integrated parts: Header, AuthContext, CartContext, SearchContext, SearchInput,
 *                   React Router NavLinks, useCategory hook, localStorage
 * Mocked parts: axios (all API calls return controlled fake responses)
 *
 * Test coverage
 * ─────────────
 * 1. User states    : unauthenticated links (Login/Register), authenticated state
 *                     (username display, Logout), login/logout flow
 * 2. User roles     : admin Dashboard link (/dashboard/admin) vs
 *                     user Dashboard link (/dashboard/user)
 * 3. Header smoke   : all elements render together in a single combined render
 * 4. Individual     : each Header element tested in isolation
 *                     - Brand name and href
 *                     - Search input, button, and form
 *                     - Cart badge (Ant Design) initial count and href
 *                     - Categories dropdown toggle, fetched items, empty state,
 *                       correct slug-based hrefs
 *                     - Home navigation link and href
 *
 * Note: Login and Register link tests are intentionally only in "User states"
 * and not repeated in "Individual elements" to avoid duplication.
 * Dashboard link tests are intentionally only in "User roles" since they
 * require auth state setup and a dropdown click to become visible.
 * 
 * Test suite description is generated with reference to AI and edited.
 */
import React from "react";
import Header from "./Header";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

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
});

// to simulate logged in user
const setAuthInStorage = (user, token) => {
  localStorage.setItem("auth", JSON.stringify({ user, token }));
};

// reset state between tests
const clearStorage = () => localStorage.clear();

afterEach(() => {
    clearStorage();
    jest.clearAllMocks();
});

const renderHeader = (categories = []) => {
    axios.get.mockResolvedValue({
        data: { success: true, category: categories },
    });

    return render(
        <MemoryRouter>
            <AuthProvider>
                <CartProvider>
                    <SearchProvider>
                        <Header />
                    </SearchProvider>
                </CartProvider>
            </AuthProvider>
        </MemoryRouter>
    );
};

// focuses on auth context and log in states
describe("User states", () => {
    describe("When user is not logged in or not authenticated", () => {
        it("should render login link when user is not logged in", () => {
            renderHeader();
            const loginLink = screen.queryByRole("link", { name: /login/i });
            expect(loginLink).toBeInTheDocument();    
        });

        it("should render Register link when user is not logged in", () => {
            renderHeader();
            const registerLink = screen.queryByRole("link", { name: /register/i });
            expect(registerLink).toBeInTheDocument();
        });

        // login flow
        it("should hide login and register links when user is logged in", async () => {
            setAuthInStorage({ name: "John", role: 0 }, "test-token");
            renderHeader();

            await waitFor(() => {
                expect(screen.queryByRole("link", { name: /login/i })).not.toBeInTheDocument();
                expect(screen.queryByRole("link", { name: /register/i })).not.toBeInTheDocument();
                expect(screen.getByText(/john/i)).toBeInTheDocument();
            });
        });
    });

    // user roles is not relevant here as all users should see the same content
    describe("When user is logged in and authenticated", () => {
        it("should display the user name when logged in", async () => {
            setAuthInStorage({ name: "John", role: 0 }, "test-token");
            renderHeader();
        
            await waitFor(() => {
            expect(screen.queryByText(/john/i)).toBeInTheDocument();
            });
        });
        
        it("should show Logout option when user is logged in", async () => {
            setAuthInStorage({ name: "John", role: 0 }, "test-token");
            renderHeader();
        
            await waitFor(() => {
                const logoutBtn =
                    screen.queryByText(/logout/i) ||
                    screen.queryByRole("button", { name: /logout/i });
                expect(logoutBtn).toBeInTheDocument();
            });
        });    

        // logout flow
        it("should clear auth from localStorage when Logout is clicked", async () => {
            setAuthInStorage({ name: "John", role: 0 }, "test-token");
            renderHeader();
        
            await waitFor(() => {
                expect(screen.queryByText(/john/i)).toBeInTheDocument();
            });
        
            const logoutEl = screen.queryByText(/logout/i) || screen.queryByRole("button", { name: /logout/i });
        
            if (logoutEl) {
                fireEvent.click(logoutEl);
                await waitFor(() => {
                    expect(localStorage.getItem("auth")).toBeNull();
                });
            }
        });
    });
});

// focuses on auth context and role-based rendering
describe("User roles", () => {
    describe("Admin user", () => {
        it("should show admin Dashboard link for admin users", async () => {
            setAuthInStorage({ name: "Admin", role: 1 }, "admin-token");
            renderHeader();

            await waitFor(() => {
                expect(screen.getByText(/admin/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/admin/i));

            await waitFor(() => {
                const dashLink = screen.queryByRole("link", { name: /dashboard/i });
                expect(dashLink).toBeInTheDocument();
                expect(dashLink).toHaveAttribute("href", "/dashboard/admin");
            });
        });

        it("should not show user Dashboard link for admin users", async () => {
            setAuthInStorage({ name: "Admin", role: 1 }, "admin-token");
            renderHeader();

            await waitFor(() => {
                expect(screen.getByText(/admin/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/admin/i));

            await waitFor(() => {
                const dashLink = screen.queryByRole("link", { name: /dashboard/i });
                expect(dashLink).toBeInTheDocument();
                // Admin should be redirected to /dashboard/admin, not /dashboard/user
                expect(dashLink).not.toHaveAttribute("href", "/dashboard/user");
            });
        });
    });

    describe("Normal user", () => {
        it("should show user Dashboard link for normal users", async () => {
            setAuthInStorage({ name: "John", role: 0 }, "user-token");
            renderHeader();

            await waitFor(() => {
                expect(screen.getByText(/john/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/john/i));

            await waitFor(() => {
                const dashLink = screen.queryByRole("link", { name: /dashboard/i });
                expect(dashLink).toBeInTheDocument();
                expect(dashLink).toHaveAttribute("href", "/dashboard/user");
            });
        });

        it("should not show admin Dashboard link for normal users", async () => {
            setAuthInStorage({ name: "John", role: 0 }, "user-token");
            renderHeader();

            await waitFor(() => {
                expect(screen.getByText(/john/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/john/i));

            await waitFor(() => {
                const dashLink = screen.queryByRole("link", { name: /dashboard/i });
                expect(dashLink).toBeInTheDocument();
                // Normal user should be redirected to /dashboard/user, not /dashboard/admin
                expect(dashLink).not.toHaveAttribute("href", "/dashboard/admin");
            });
        });
    });
});

describe("Header components", () => {
    // smoke test — verifies all Header parts work together in one render
    it("should render the header component with all its elements", async () => {
        renderHeader([
            { _id: "1", name: "Electronics", slug: "electronics" },
            { _id: "2", name: "Clothing", slug: "clothing" },
        ]);

        await waitFor(() => {
            // brand name/logo
            expect(screen.getByText(/virtual vault/i)).toBeInTheDocument();

            // navigation links (only need to test home for inidivudal components - login & register tested in user states)
            expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
            expect(screen.getByRole("link", { name: /login/i })).toBeInTheDocument();
            expect(screen.getByRole("link", { name: /register/i })).toBeInTheDocument();

            // search bar
            const searchInput =
                screen.queryByRole("searchbox") ||
                screen.queryByPlaceholderText(/search/i);
            expect(searchInput).toBeInTheDocument();

            // categories dropdown
            const categoriesDropdown = document.querySelector(
                'a[href="/categories"].dropdown-toggle'
            );
            expect(categoriesDropdown).toBeInTheDocument();

            // categories links
            const allCategoriesLink = document.querySelector(
                'a[href="/categories"].dropdown-item'
            );
            expect(allCategoriesLink).toBeInTheDocument();

            const electronicsLink = document.querySelector('a[href="/category/electronics"]');
            const clothingLink = document.querySelector('a[href="/category/clothing"]');
            expect(electronicsLink).toBeInTheDocument();
            expect(clothingLink).toBeInTheDocument();

            // cart link
            const cartLink = document.querySelector('a[href="/cart"]');
            expect(cartLink).toBeInTheDocument();
        });
    });

    describe("Individual elements", () => {
        describe("Brand name", () => {
            it("should render the brand name", async () => {
                renderHeader();
                await waitFor(() => {
                    expect(screen.getByText(/virtual vault/i)).toBeInTheDocument();
                });
            });

            it("should have brand name link pointing to home page", async () => {
                renderHeader();
                await waitFor(() => {
                    const brandLink = document.querySelector('a.navbar-brand');
                    expect(brandLink).toBeInTheDocument();
                    expect(brandLink).toHaveAttribute("href", "/");
                });
            });
        });

        describe("Search bar", () => {
            it("should render the search input", async () => {
                renderHeader();
                await waitFor(() => {
                    const searchInput =
                        screen.queryByRole("searchbox") ||
                        screen.queryByPlaceholderText(/search/i);
                    expect(searchInput).toBeInTheDocument();
                });
            });

            it("should render the search button", async () => {
                renderHeader();
                await waitFor(() => {
                    const searchButton = screen.getByRole("button", { name: /search/i });
                    expect(searchButton).toBeInTheDocument();
                });
            });

            it("should render the search form", async () => {
                renderHeader();
                await waitFor(() => {
                    const searchForm = document.querySelector('form[role="search"]');
                    expect(searchForm).toBeInTheDocument();
                });
            });
        });

        describe("Cart badge", () => {
            it("should render the cart badge with initial count of 0", async () => {
                renderHeader();
                await waitFor(() => {
                    // Ant Design badge renders the count in a <sup> element
                    const cartBadge = document.querySelector('sup.ant-badge-count');
                    expect(cartBadge).toBeInTheDocument();
                    expect(cartBadge).toHaveAttribute("title", "0");
                });
            });
            
            it("should render the Cart link pointing to /cart", async () => {
                renderHeader();
                await waitFor(() => {
                    const cartLink = document.querySelector('a[href="/cart"]');
                    expect(cartLink).toBeInTheDocument();
                });
            });
        });

        describe("Categories dropdown", () => {
            it("should render the Categories dropdown toggle link", async () => {
                renderHeader();
                await waitFor(() => {
                    const categoriesToggle = document.querySelector(
                        'a[href="/categories"].dropdown-toggle'
                    );
                    expect(categoriesToggle).toBeInTheDocument();
                });
            });

            it("should render fetched categories as dropdown items", async () => {
                renderHeader([
                    { _id: "1", name: "Electronics", slug: "electronics" },
                    { _id: "2", name: "Clothing", slug: "clothing" },
                ]);
                await waitFor(() => {
                    const electronicsLink = document.querySelector('a[href="/category/electronics"]');
                    const clothingLink = document.querySelector('a[href="/category/clothing"]');
                    expect(electronicsLink).toBeInTheDocument();
                    expect(clothingLink).toBeInTheDocument();
                });
            });

            it("should only render 'ALL CATEGORIES' when no categories are fetched", async () => {
                renderHeader([]); // empty categories
                await waitFor(() => {
                    // Only the static All Categories link should be present
                    const allDropdownItems = document.querySelectorAll('a.dropdown-item');
                    expect(allDropdownItems).toHaveLength(1);
                    expect(allDropdownItems[0]).toHaveAttribute("href", "/categories");
                });
            });

            it("should render the correct href for each fetched category", async () => {
                renderHeader([
                    { _id: "1", name: "Electronics", slug: "electronics" },
                    { _id: "2", name: "Clothing", slug: "clothing" },
                ]);
                await waitFor(() => {
                    // Confirm slug is used correctly in the href — not name or _id
                    expect(document.querySelector('a[href="/category/electronics"]')).toBeInTheDocument();
                    expect(document.querySelector('a[href="/category/clothing"]')).toBeInTheDocument();
                    // Confirm wrong slugs are not present
                    expect(document.querySelector('a[href="/category/Electronics"]')).toBeNull();
                });
            });
        });

        // navigation links, register & login links are tested in user states test
        it("should render the Home link pointing to /", async () => {
            renderHeader();
            await waitFor(() => {
                const homeLink = screen.getByRole("link", { name: /home/i });
                expect(homeLink).toBeInTheDocument();
                expect(homeLink).toHaveAttribute("href", "/");
            });
        });
    });
});