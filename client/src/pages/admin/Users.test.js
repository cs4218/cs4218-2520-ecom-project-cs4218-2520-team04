//
// Lu Yixuan, Deborah, A0277911X
//
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock child components in a way that lets us assert props
jest.mock("../../components/AdminMenu", () => () => (
  <div data-testid="admin-menu">AdminMenu Mock</div>
));

jest.mock("../../components/Layout", () => (props) => (
  <div data-testid="layout">
    <div data-testid="layout-title">{props.title}</div>
    {props.children}
  </div>
));

import Users from "./Users";

describe("Users (unit/component)", () => {
  test("Given page renders, Then it shows admin menu and heading", () => {
    // When
    render(<Users />);

    // Then
    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All Users" })).toBeInTheDocument();
  });

  test("Given Users page, Then it passes correct title to Layout", () => {
    // When
    render(<Users />);

    // Then
    expect(screen.getByTestId("layout-title")).toHaveTextContent(
      "Dashboard - All Users"
    );
  });
});
