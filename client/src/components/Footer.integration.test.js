/**
 * By: Yeo Yi Wen, A0273575U
 * Integration tests for client/src/components/Footer.js
 *
 * Footer integrates with two external dependencies: React Router (for Link
 * navigation) and the Layout shell (which pulls in Header and its contexts).
 * These tests verify both integration boundaries.
 *
 * Integrated parts: Footer, React Router Links, MemoryRouter, Layout, Header,
 *                 AuthContext, CartContext, SearchContext
 * Mocked parts:  axios (all API calls return controlled fake responses)
 *
 * Test coverage
 * ─────────────
 * 1. Standalone Footer    : Footer renders individually without crashing, links exist with correct hrefs
 * 2. Footer inside Layout : Footer to be integrated in Layout without breaking rendering
 * 3. Navigation           : clicking footer links actually changes the active route
 *
 * Note: The full content of /about, /contact, and /policy pages is not tested here.
 * Dummy route elements are used as placeholders since full page rendering
 * is the responsibility of E2E tests (Playwright).
 * 
 * Test suite description is generated with reference to AI and edited.
 */
import React from "react";
import axios from "axios";
import Footer from "./Footer";
import Layout from "./Layout";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// providers for header component so that layout can render properly when testing footer in layout
import { AuthProvider } from "../context/auth";
import { CartProvider } from "../context/cart";
import { SearchProvider } from "../context/search";

// intercept http requests (get & post)
jest.mock("axios"); 

// silence console noise in tests
beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
    jest.restoreAllMocks();
});

// footer component only
const renderFooter = () => {
    render(
        <MemoryRouter>
            <Footer />
        </MemoryRouter>
    );
};

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

// standalone rendering for footer
describe("Footer component only", () => {
    // footer should be rendered before checking for links
    it("should render without crashing inside a Router", () => {
        expect(() => renderFooter()).not.toThrow();
    });

    // Router links, only test if link is correct but doesnt navigate to it
    it("should render the About link and point to /about", () => {
        renderFooter();
        const link = screen.queryByRole("link", { name: /about/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute("href", "/about");
    });
    
    it("should render the Contact link and point to /contact", () => {
        renderFooter();
        const link = screen.queryByRole("link", { name: /contact/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute("href", "/contact");
    });
    
    it("should render the Privacy Policy link and point to /policy", () => {
        renderFooter();
        const link = screen.queryByRole("link", { name: /policy/i });
        expect(link).toBeInTheDocument();
        expect(link.getAttribute("href")).toMatch(/\/policy/);
    });
});

// Footer <-> Layout
describe("Footer component in layout component", () => {
    it("should not break Layout children rendering", () => {
        expect(() => renderLayout()).not.toThrow();
    });
 
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

// check if navigation from footer links works correctly
// dummy pages used as rendering of individual pages is best suited for E2E tests
describe("Navigation from footer links", () => {
    test.each([
        { name: /about/i, path: "/about", expectedText: "About Page Loaded" },
        { name: /contact/i, path: "/contact", expectedText: "Contact Page Loaded" },
        { name: /privacy policy/i, path: "/policy", expectedText: "Policy Page Loaded" },
    ])("should navigate to $path when the link is clicked", async ({ name, path, expectedText }) => {
        render(
            <MemoryRouter initialEntries={["/"]}>
                <Footer />
                <Routes>
                    <Route path={path} element={<div>{expectedText}</div>} />
                </Routes>
            </MemoryRouter>
        );

        const link = screen.getByRole("link", { name });
        userEvent.click(link);

        expect(await screen.findByText(expectedText)).toBeInTheDocument();
    });
});