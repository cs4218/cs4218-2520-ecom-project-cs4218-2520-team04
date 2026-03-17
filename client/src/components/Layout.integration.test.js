/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * Integration tests for Layout.js
 *
 * Layout is the top-level component that composes Header, Footer, and
 * page-specific children together. These tests verify that Layout correctly
 * integrates with its child components by rendering them inside real context
 * providers and a MemoryRouter. Only the network layer (axios) is mocked.
 *
 * Components under test
 * ─────────────────────
 * Header    : verifies it is rendered and categories are fetched via useCategory
 * Footer    : verifies it is rendered with correct navigation links
 * Children  : verifies Layout correctly renders any children passed to it
 * Helmet    : verifies default and custom title/meta props are applied to the document
 * -> Toaster is not tested as it is a third-party library and its not relevant
 *
 * Integrated parts:  Layout, Header, Footer, React Router Links, react-helmet,
 *                  AuthContext, CartContext, SearchContext
 * Mocked parts:  axios (all API calls return controlled fake responses)
 *
 * Note: Header-specific behaviour (login state, logout, cart badge, admin role)
 * is intentionally not tested here — those belong in Header.integration.test.js.
 * The category fetch test is included only as a smoke test to confirm Header
 * is genuinely mounted and operational inside Layout.
 *
 * The final test is a combined smoke test that renders all parts together.
 * Individual describe blocks above it give more precise failure attribution.
 * 
 * Test suite description is generated with reference to AI and edited.
 */
import React from "react";
import Layout from "./Layout";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";

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

afterAll(() => {
    jest.restoreAllMocks();
});

// ensures that Header is mounted inside Layout as useCategory hook is triggered by Layout rendering without any navigation by clicking on the dropdown
// header links are tested in Header.integration.test.js, so we only verify if the header is rendered in Layout.integration.test.js
const defaultCategoriesResponse = {
    data: { success: true, category: [] },
};

// needs defaultCategoriesResponse to be defined first
beforeEach(() => {
    axios.get.mockResolvedValue(defaultCategoriesResponse);
});

// render layout component with default props and children
// providers are needed for header component to allow layout to render properly
const renderLayout = (props = {}, children = <p>Child Content</p>) => {
    return render(
        <MemoryRouter>
            <AuthProvider>
                <CartProvider>
                    <SearchProvider>
                        <Layout {...props}>{children}</Layout>
                    </SearchProvider>
                </CartProvider>
            </AuthProvider>
        </MemoryRouter>
    );
};

describe("Header component", () => {
    it("should render header content", async () => {
        renderLayout();
        const headerElement = screen.getByText(/Virtual Vault/i);
        expect(headerElement).toBeInTheDocument();
    });

    it("should render header navigation", async () => {
        renderLayout();
        await waitFor(() => {
            const nav = document.querySelector("nav");
            expect(nav).toBeInTheDocument();
        });
    });

    it("should display fetched categories in Header navigation", async () => {
        axios.get.mockResolvedValue({
            data: {
                success: true,
                category: [
                    { _id: "1", name: "Category 1", slug: "category-1" },
                    { _id: "2", name: "Category 2", slug: "category-2" },
                ],
            },
        });
    
        renderLayout();
    
        await waitFor(() => {
            expect(screen.queryByText("Category 1")).toBeInTheDocument();
            expect(screen.queryByText("Category 2")).toBeInTheDocument();
        });
    });
});

// simple elements is used to test child components as the goal is to only verify if Layout correctly renders any children passed to it
describe("Children components", () => {
    it("should render a child component inside Layout", () => {
        renderLayout({}, <p>Single Child</p>);
        expect(screen.getByText("Single Child")).toBeInTheDocument();
    });

    it("should render multiple child components inside Layout", () => {
        renderLayout({}, <><h1>Child 1</h1><p>Child 2</p></>);
        expect(screen.getByText("Child 1")).toBeInTheDocument();
        expect(screen.getByText("Child 2")).toBeInTheDocument();
    });
});

describe("Footer component", () => {
    it("should render the footer content", async () => {
        renderLayout();
        const footerElement = screen.getByText(/All Rights Reserved © TestingComp/i);
        expect(footerElement).toBeInTheDocument();
    });

    it("should render Footer with the About link", async () => {
        renderLayout();
        await waitFor(() => {
        const aboutLink = screen.queryByRole("link", { name: /about/i });
        expect(aboutLink).toBeInTheDocument();
        });
    });
    
    it("should render Footer with the Contact link", async () => {
        renderLayout();
        await waitFor(() => {
        const contactLink = screen.queryByRole("link", { name: /contact/i });
        expect(contactLink).toBeInTheDocument();
        });
    });
    
    it("should render Footer with the Privacy Policy link", async () => {
        renderLayout();
        await waitFor(() => {
        const policyLink = screen.queryByRole("link", { name: /privacy policy/i });
        expect(policyLink).toBeInTheDocument();
        });
    });
});

describe("Helmet component", () => {
    describe("Default props", () => {
        it("should render when no props are provided", () => {
            expect(() => renderLayout()).not.toThrow();
        });

        it("should set default title", async () => {
            renderLayout();
            await waitFor(() => {
                expect(document.title).toBe("Ecommerce app - shop now");
            });
        });

        test.each([
            { prop: "description", content: "mern stack project" },
            { prop: "keywords", content: "mern,react,node,mongodb" },
            { prop: "author", content: "Techinfoyt" },
        ])("should set default meta tag for $prop", async ({ prop, content }) => {
            renderLayout();
            await waitFor(() => {
                const metaTag = document.querySelector(`meta[name="${prop}"]`);
                expect(metaTag).toBeInTheDocument();
                expect(metaTag.getAttribute("content")).toBe(content);
            });
        });
    });

    describe("Custom props", () => {
        it("should set custom title", async () => {
            renderLayout({ title: "Custom Title" });
            await waitFor(() => {
                expect(document.title).toBe("Custom Title");
            });
        });

        test.each([
            { prop: "description", content: "Custom description" },
            { prop: "keywords", content: "custom,keywords" },
            { prop: "author", content: "Custom Author" },
        ])("should set custom meta tag for $prop", async ({ prop, content }) => {
            renderLayout({ [prop]: content });
            await waitFor(() => {
                const metaTag = document.querySelector(`meta[name="${prop}"]`);
                expect(metaTag).toBeInTheDocument();
                expect(metaTag.getAttribute("content")).toBe(content);
            });
        });
    });
});

// smoke test — verifies all Layout parts work together in one render
// individual component tests above give more precise failure attribution
it("should render Header, Footer, children and title together", async () => {
    renderLayout(
        { title: "Full Layout Test" },
        <div data-testid="page-body">Page Body</div>
    );

    // title via Helmet
    await waitFor(() => {
        expect(document.title).toBe("Full Layout Test");
    });

    // Header
    const nav = document.querySelector("nav");
    expect(nav).toBeInTheDocument();

    // children
    expect(screen.getByTestId("page-body")).toBeInTheDocument();

    // Footer
    expect(screen.getByRole("link", { name: /about/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contact/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /privacy policy/i })).toBeInTheDocument();
});