/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * Unit tests for Policy.js
 *
 * The Privacy Policy page displays a banner image alongside a set of placeholder
 * paragraphs that will eventually hold the application's privacy policy text.
 * These tests verify that the image renders correctly and that all expected
 * placeholder paragraphs and the page title are present.
 * 
 * Test suite is generated with reference to AI and edited accordingly by me.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import Policy from "./Policy";

jest.mock("../components/Layout", () => ({ title, children }) => (
  <div>
    <title>{title}</title>
    {children}
  </div>
));

describe("Policy page", () => {
  beforeEach(() => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <Policy />
      </MemoryRouter>
    );
  });

  test("should render the policy image", () => {
    // Assert
    const img = screen.getByAltText("contactus");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/images/contactus.jpeg");
  });

  test("should render privacy policy placeholder text", () => {
    // Assert
    const paragraphs = screen.getAllByText("add privacy policy");
    expect(paragraphs.length).toBe(7);
  });

  test("should render with correct page title", () => {
    // Assert
    expect(document.title).toBe("Privacy Policy");
  });
});
