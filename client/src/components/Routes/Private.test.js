//
// Tan Wei Lian, A0269750U
//
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import "@testing-library/jest-dom";
import PrivateRoute from "./Private";
import { useAuth } from "../../context/auth";

jest.mock("axios");

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../Spinner", () => {
  const React = require("react");
  return function MockSpinner() {
    return React.createElement("div", { "data-testid": "spinner" }, "Spinner");
  };
});

const ChildComponent = () => <div data-testid="child">Protected Content</div>;

const renderPrivateRoute = () =>
  render(
    <MemoryRouter initialEntries={["/private"]}>
      <Routes>
        <Route path="/private" element={<PrivateRoute />}>
          <Route path="" element={<ChildComponent />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe("PrivateRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should render Spinner when auth token is not present", () => {
    // Arrange
    useAuth.mockReturnValue([{}, jest.fn()]);

    // Act
    renderPrivateRoute();

    // Assert
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("should render Spinner when auth is null", () => {
    // Arrange
    useAuth.mockReturnValue([null, jest.fn()]);

    // Act
    renderPrivateRoute();

    // Assert
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("should render Outlet (child content) when auth check succeeds", async () => {
    // Arrange
    useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);
    axios.get.mockResolvedValue({ data: { ok: true } });

    // Act
    renderPrivateRoute();

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  test("should render Spinner when auth check returns ok: false", async () => {
    // Arrange
    useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);
    axios.get.mockResolvedValue({ data: { ok: false } });

    // Act
    renderPrivateRoute();

    // Assert
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  test("should call the correct auth endpoint", async () => {
    // Arrange
    useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);
    axios.get.mockResolvedValue({ data: { ok: true } });

    // Act
    renderPrivateRoute();

    // Assert
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/user-auth");
    });
  });

  test("should re-trigger auth check when token changes", async () => {
    // Arrange — start with no token
    const mockSetAuth = jest.fn();
    useAuth.mockReturnValue([{}, mockSetAuth]);

    const { rerender } = render(
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route path="/private" element={<PrivateRoute />}>
            <Route path="" element={<ChildComponent />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Assert — no API call without token
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();

    // Act — re-render with a token
    useAuth.mockReturnValue([{ token: "new-token" }, mockSetAuth]);
    axios.get.mockResolvedValue({ data: { ok: true } });

    rerender(
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route path="/private" element={<PrivateRoute />}>
            <Route path="" element={<ChildComponent />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Assert — API call triggered with new token
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/user-auth");
    });
  });

  test("should render Spinner when auth check fails with network error", async () => {
    // Arrange
    useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);
    axios.get.mockRejectedValue(new Error("Network Error"));

    // Act
    renderPrivateRoute();

    // Assert
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });
});
