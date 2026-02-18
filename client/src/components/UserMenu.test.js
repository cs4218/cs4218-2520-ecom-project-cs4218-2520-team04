//
// Tan Wei Lian, A0269750U
//
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import UserMenu from "./UserMenu";

describe("UserMenu", () => {
  const renderUserMenu = () =>
    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    );

  test("should render Dashboard heading", () => {
    // Arrange & Act
    renderUserMenu();

    // Assert
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  test("should render Profile and Orders links", () => {
    // Arrange & Act
    renderUserMenu();

    // Assert
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
  });

  test("should have Profile link pointing to /dashboard/user/profile", () => {
    // Arrange & Act
    renderUserMenu();

    // Assert
    const profileLink = screen.getByText("Profile");
    expect(profileLink).toHaveAttribute("href", "/dashboard/user/profile");
  });

  test("should have Orders link pointing to /dashboard/user/orders", () => {
    // Arrange & Act
    renderUserMenu();

    // Assert
    const ordersLink = screen.getByText("Orders");
    expect(ordersLink).toHaveAttribute("href", "/dashboard/user/orders");
  });

  test("should render links within a list-group container", () => {
    // Arrange & Act
    renderUserMenu();

    // Assert — verify the Dashboard heading and both links are rendered together
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Orders" })).toBeInTheDocument();
  });
});
