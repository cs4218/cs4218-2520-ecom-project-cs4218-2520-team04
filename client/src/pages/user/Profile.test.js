//
// Lu Yixuan, Deborah, A0277911X
//
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import Profile from "./Profile";
import axios from "axios";
import toast from "react-hot-toast";

jest.mock("axios");

jest.mock("./../../components/Layout", () => (props) => (
  <div>
    <div data-testid="layout-title">{props.title}</div>
    {props.children}
  </div>
));

jest.mock("../../components/UserMenu", () => () => <div data-testid="user-menu" />);

jest.mock("react-hot-toast", () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const mockUseAuth = jest.fn();
jest.mock("../../context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const setInput = (placeholder, value) => {
  fireEvent.change(screen.getByPlaceholderText(placeholder), {
    target: { value },
  });
};

describe("Profile (unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockUseAuth.mockReturnValue([{ token: null, user: null }, jest.fn()]);
  });

  test("handles null auth.user by defaulting fields to empty strings", () => {
    // Given
    const setAuth = jest.fn();
    mockUseAuth.mockReturnValue([{ token: "t", user: null }, setAuth]);

    // When
    render(<Profile />);

    // Then
    expect(screen.getByPlaceholderText("Enter Your Name")).toHaveValue("");
    expect(screen.getByPlaceholderText("Enter Your Phone")).toHaveValue("");
    expect(screen.getByPlaceholderText("Enter Your Address")).toHaveValue("");

    const emailInput = screen.getByPlaceholderText(/Enter Your Email/i);
    expect(emailInput).toHaveValue("");
    expect(emailInput).toBeDisabled();

    expect(screen.getByPlaceholderText("Enter Your Password")).toHaveValue("");
  });

  test("prefills form fields from auth.user on mount (name/phone/email/address)", () => {
    // Given
    const setAuth = jest.fn();
    mockUseAuth.mockReturnValue([
      {
        token: "t",
        user: {
          name: "Test",
          email: "test@example.com",
          phone: "91234567",
          address: "SG",
        },
      },
      setAuth,
    ]);

    // When
    render(<Profile />);

    // Then
    expect(screen.getByPlaceholderText("Enter Your Name")).toHaveValue("Test");
    expect(screen.getByPlaceholderText("Enter Your Phone")).toHaveValue("91234567");
    expect(screen.getByPlaceholderText("Enter Your Address")).toHaveValue("SG");

    const emailInput = screen.getByPlaceholderText(/Enter Your Email/i);
    expect(emailInput).toHaveValue("test@example.com");
    expect(emailInput).toBeDisabled();
  });

  test("submits updated profile; calls axios.put with correct payload; updates auth + localStorage; shows success toast", async () => {
    // Given
    const setAuth = jest.fn();

    const initialAuth = {
      token: "t",
      user: {
        name: "Old Name",
        email: "old@example.com",
        phone: "90000000",
        address: "Old Addr",
      },
    };

    mockUseAuth.mockReturnValue([initialAuth, setAuth]);
    localStorage.setItem("auth", JSON.stringify({ ...initialAuth }));

    const updatedUser = {
      name: "New Name",
      email: "old@example.com",
      phone: "98887777",
      address: "New Addr",
    };

    axios.put.mockResolvedValueOnce({ data: { updatedUser } });

    // When
    render(<Profile />);

    setInput("Enter Your Name", "New Name");
    setInput("Enter Your Password", "Newpass1!");
    setInput("Enter Your Phone", "98887777");
    setInput("Enter Your Address", "New Addr");

    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    // Then
    await waitFor(() => expect(axios.put).toHaveBeenCalled());

    expect(axios.put).toHaveBeenCalledWith("/api/v1/auth/profile", {
      name: "New Name",
      email: "old@example.com",
      password: "Newpass1!",
      phone: "98887777",
      address: "New Addr",
    });

    expect(setAuth).toHaveBeenCalledWith({
      ...initialAuth,
      user: updatedUser,
    });

    const ls = JSON.parse(localStorage.getItem("auth"));
    expect(ls.user).toEqual(updatedUser);

    expect(toast.success).toHaveBeenCalledWith("Profile Updated Successfully");
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("if API responds with data.error, shows toast.error and does not update auth/localStorage", async () => {
    // Given
    const setAuth = jest.fn();
    const initialAuth = {
      token: "t",
      user: { name: "Test", email: "test@example.com", phone: "1", address: "x" },
    };

    mockUseAuth.mockReturnValue([initialAuth, setAuth]);
    localStorage.setItem("auth", JSON.stringify({ ...initialAuth }));

    axios.put.mockResolvedValueOnce({
      data: { error: "Bad things" },
    });

    // When
    render(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    // Then
    await waitFor(() => expect(axios.put).toHaveBeenCalled());

    expect(toast.error).toHaveBeenCalledWith("Bad things");
    expect(toast.success).not.toHaveBeenCalled();
    expect(setAuth).not.toHaveBeenCalled();

    const ls = JSON.parse(localStorage.getItem("auth"));
    expect(ls.user).toEqual(initialAuth.user);
  });

  test('if axios.put throws, shows "Something went wrong" toast.error', async () => {
    // Given
    const setAuth = jest.fn();
    const initialAuth = {
      token: "t",
      user: { name: "Test", email: "test@example.com", phone: "1", address: "x" },
    };

    mockUseAuth.mockReturnValue([initialAuth, setAuth]);
    localStorage.setItem("auth", JSON.stringify({ ...initialAuth }));

    axios.put.mockRejectedValueOnce(new Error("network"));

    // When
    render(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    // Then
    await waitFor(() => expect(axios.put).toHaveBeenCalled());

    expect(toast.error).toHaveBeenCalledWith("Something went wrong");
    expect(toast.success).not.toHaveBeenCalled();
    expect(setAuth).not.toHaveBeenCalled();
  });
});
