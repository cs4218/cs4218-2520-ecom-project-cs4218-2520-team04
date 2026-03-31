/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * Unit tests for About.js
 *
 * The About page displays a banner image and a short description about the
 * ecommerce application. These tests verify that the image is rendered with the
 * correct source and alt text, that the placeholder description text is present,
 * and that the browser tab title is set correctly.
 * 
 * Test suite is generated with reference to AI and edited accordingly by me.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import About from "./About";

jest.mock("../components/Layout", () => ({ title, children }) => (
  <div>
    <title>{title}</title>
    {children}
  </div>
));

describe("About page", () => {
  beforeEach(() => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>
    );
  });

  test("should render the about image", () => {
    // Assert
    const img = screen.getByAltText("contactus");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/images/about.jpeg");
  });

  test("should render the about description text", () => {
    // Assert
    expect(screen.getByText("Add text")).toBeInTheDocument();
  });

  test("should render with correct page title", () => {
    // Assert
    expect(document.title).toBe("About us - Ecommerce app");
  });
});
