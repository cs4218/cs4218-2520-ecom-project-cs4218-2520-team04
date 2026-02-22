//
// Lu Yixuan, Deborah, A0277911X
//
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import Users from "./Users"; 

// Mock child components
jest.mock("../../components/AdminMenu", () => () => (
  <div data-testid="admin-menu">AdminMenu Mock</div>
));

jest.mock("../../components/Layout", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));

describe("Users Component", () => {
  it("renders layout, admin menu, and All Users heading", () => {
    const { container } = render(<Users />);

    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /All Users/i })).toBeInTheDocument();

    expect(container.querySelector(".col-md-3")).toBeInTheDocument();
    expect(container.querySelector(".col-md-9")).toBeInTheDocument();
  });
});
