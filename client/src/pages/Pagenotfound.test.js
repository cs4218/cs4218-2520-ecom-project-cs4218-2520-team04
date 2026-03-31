/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * Unit tests for Pagenotfound.js
 *
 * The 404 page is shown when a user navigates to a route that does not exist.
 * These tests verify that the error code, descriptive heading, and a "Go Back"
 * link to the home page are all rendered correctly so that users are never left
 * stranded without a way to return to the application.
 * 
 * Test suite is generated with reference to AI and edited accordingly by me.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import Pagenotfound from "./Pagenotfound";

jest.mock("../components/Layout", () => ({ title, children }) => (
  <div>
    <title>{title}</title>
    {children}
  </div>
));

describe("Pagenotfound page", () => {
  beforeEach(() => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <Pagenotfound />
      </MemoryRouter>
    );
  });

  test("should render 404 title", () => {
    // Assert
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  test("should render page not found heading", () => {
    // Assert
    expect(screen.getByText(/Oops ! Page Not Found/i)).toBeInTheDocument();
  });

  test("should render Go Back link pointing to /", () => {
    // Assert
    const link = screen.getByRole("link", { name: /go back/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  test("should render with correct page title", () => {
    // Assert
    expect(document.title).toBe("go back- page not found");
  });
});
