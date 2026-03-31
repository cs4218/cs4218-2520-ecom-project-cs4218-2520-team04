/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * Unit tests for Footer.js
 *
 * Footer renders a copyright text and three navigation links (About, Contact,
 * Privacy Policy). These tests verify that the correct text and link are
 * rendered so that users can always navigate to these pages from the footer
 * 
 * Test suite is generated with reference to AI and edited accordingly by me.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import Footer from "./Footer";

const renderFooter = () => {
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  );
};

describe("Footer component", () => {
  test("should render copyright text", () => {
    // Arrange & Act
    renderFooter();

    // Assert
    expect(
      screen.getByText(/All Rights Reserved © TestingComp/i)
    ).toBeInTheDocument();
  });

  test("should render About link pointing to /about", () => {
    // Arrange & Act
    renderFooter();

    // Assert
    const link = screen.getByRole("link", { name: /about/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/about");
  });

  test("should render Contact link pointing to /contact", () => {
    // Arrange & Act
    renderFooter();

    // Assert
    const link = screen.getByRole("link", { name: /contact/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/contact");
  });

  test("should render Privacy Policy link pointing to /policy", () => {
    // Arrange & Act
    renderFooter();

    // Assert
    const link = screen.getByRole("link", { name: /privacy policy/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/policy");
  });
});
