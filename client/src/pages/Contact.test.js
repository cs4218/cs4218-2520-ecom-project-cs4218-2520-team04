/**
 * By: Yeo Yi Wen, A0273575U
 * 
 * Unit tests for Contact.js
 *
 * The Contact page provides users with ways to reach the support team, including
 * an email address, phone number, and a toll-free number, each accompanied by an
 * icon. These tests verify that all contact details, icons, the banner image, the
 * section heading, and the page title are rendered correctly.
 * 
 * Test suite is generated with reference to AI and edited accordingly by me.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import Contact from "./Contact";

jest.mock("../components/Layout", () => ({ title, children }) => (
  <div>
    <title>{title}</title>
    {children}
  </div>
));

jest.mock("react-icons/bi", () => ({
  BiMailSend: () => <span data-testid="icon-mail" />,
  BiPhoneCall: () => <span data-testid="icon-phone" />,
  BiSupport: () => <span data-testid="icon-support" />,
}));

describe("Contact page", () => {
  beforeEach(() => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <Contact />
      </MemoryRouter>
    );
  });

  test("should render the contact image", () => {
    // Assert
    const img = screen.getByAltText("contactus");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/images/contactus.jpeg");
  });

  test("should render CONTACT US heading", () => {
    // Assert
    expect(screen.getByText("CONTACT US")).toBeInTheDocument();
  });

  test("should render availability description", () => {
    // Assert
    expect(screen.getByText(/available 24X7/i)).toBeInTheDocument();
  });

  test("should render email contact detail", () => {
    // Assert
    expect(screen.getByText(/www.help@ecommerceapp.com/i)).toBeInTheDocument();
  });

  test("should render phone contact detail", () => {
    // Assert
    expect(screen.getByText(/012-3456789/i)).toBeInTheDocument();
  });

  test("should render toll free number", () => {
    // Assert
    expect(screen.getByText(/1800-0000-0000/i)).toBeInTheDocument();
  });

  test("should render mail icon", () => {
    // Assert
    expect(screen.getByTestId("icon-mail")).toBeInTheDocument();
  });

  test("should render phone icon", () => {
    // Assert
    expect(screen.getByTestId("icon-phone")).toBeInTheDocument();
  });

  test("should render support icon", () => {
    // Assert
    expect(screen.getByTestId("icon-support")).toBeInTheDocument();
  });

  test("should render with correct page title", () => {
    // Assert
    expect(document.title).toBe("Contact us");
  });
});
