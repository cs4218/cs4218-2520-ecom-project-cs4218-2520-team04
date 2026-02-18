//
// Tan Wei Lian, A0269750U
//
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import Dashboard from "./Dashboard";
import { useAuth } from "../../context/auth";

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
}));
jest.mock("../../context/cart", () => ({
  useCart: jest.fn(() => [null, jest.fn()]),
}));
jest.mock("../../context/search", () => ({
  useSearch: jest.fn(() => [{ keyword: "" }, jest.fn()]),
}));
jest.mock("../../hooks/useCategory", () => jest.fn(() => []));

jest.mock("antd", () => {
  const React = require("react");
  const Badge = ({ children }) => React.createElement("span", null, children);
  return { Badge };
});

window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };

describe("Dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should display user name, email, and address from auth context", () => {
    // Arrange
    useAuth.mockReturnValue([
      {
        token: "test-token",
        user: {
          name: "John Doe",
          email: "john@example.com",
          address: "123 Main St",
        },
      },
      jest.fn(),
    ]);

    // Act
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Assert — name appears in both header nav and dashboard card
    const nameElements = screen.getAllByText("John Doe");
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("123 Main St")).toBeInTheDocument();
  });

  test("should render UserMenu sidebar with Profile and Orders links", () => {
    // Arrange
    useAuth.mockReturnValue([
      {
        token: "test-token",
        user: { name: "Jane", email: "jane@test.com", address: "456 Oak Ave" },
      },
      jest.fn(),
    ]);

    // Act
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Assert
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
  });

  test("should handle null auth gracefully without crashing", () => {
    // Arrange
    useAuth.mockReturnValue([null, jest.fn()]);

    // Act & Assert — should not throw
    expect(() =>
      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      )
    ).not.toThrow();
  });

  test("should handle auth with missing user object gracefully", () => {
    // Arrange
    useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);

    // Act & Assert — should not throw
    expect(() =>
      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      )
    ).not.toThrow();
  });

  test("should render Dashboard heading within the card", () => {
    // Arrange
    useAuth.mockReturnValue([
      {
        token: "test-token",
        user: { name: "John", email: "john@test.com", address: "123 St" },
      },
      jest.fn(),
    ]);

    // Act
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Assert — user info is rendered as headings within the dashboard
    expect(screen.getByRole("heading", { name: "John" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "john@test.com" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "123 St" })).toBeInTheDocument();
  });

  test("should handle user with partial fields", () => {
    // Arrange
    useAuth.mockReturnValue([
      {
        token: "test-token",
        user: { name: "Partial User" },
      },
      jest.fn(),
    ]);

    // Act
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Assert — name appears in both header nav and dashboard card
    const nameElements = screen.getAllByText("Partial User");
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
  });
});
