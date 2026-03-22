// A0272558U Teo Kai Xiang
// Written by GPT 5.4 based on test plans written by me. Reviewed after
import React from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CartPage from "../../../client/src/pages/CartPage";
import Login from "../../../client/src/pages/Auth/Login";
import { AuthProvider } from "../../../client/src/context/auth";
import { CartProvider } from "../../../client/src/context/cart";
import { SearchProvider } from "../../../client/src/context/search";

var mockToastSuccess = jest.fn();
var mockToastError = jest.fn();
var mockDropInInstance = {
  requestPaymentMethod: jest.fn(),
};

jest.mock("axios");
jest.mock(
  "braintree-web-drop-in-react",
  () => {
    const React = require("react");

    return function MockDropIn({ onInstance }) {
      React.useEffect(() => {
        onInstance(mockDropInInstance);
      }, [onInstance]);

      return <div data-testid="dropin">DropIn</div>;
    };
  },
  { virtual: true },
);

const CART_ITEM = {
  _id: "prod-cart-1",
  name: "Checkout Keyboard",
  slug: "checkout-keyboard",
  description: "A mechanical keyboard that stays in cart across login flows.",
  price: 129,
};

const LOGIN_RESPONSE = {
  data: {
    success: true,
    message: "Login successful",
    user: {
      name: "Checkout User",
      email: "checkout@test.com",
      address: "123 Payment Street",
    },
    token: "token-123",
  },
};

const AUTH_WITHOUT_ADDRESS = {
  user: {
    name: "Checkout User",
    email: "checkout@test.com",
    address: "",
  },
  token: "token-no-address",
};

const LocationProbe = () => {
  const location = useLocation();

  return (
    <>
      <div data-testid="current-path">{location.pathname}</div>
      <div data-testid="current-state">{location.state || ""}</div>
    </>
  );
};

const renderLoginCheckoutFlow = () =>
  render(
    <AuthProvider>
      <SearchProvider>
        <CartProvider>
          <MemoryRouter initialEntries={["/cart"]}>
            <LocationProbe />
            <Routes>
              <Route path="/cart" element={<CartPage />} />
              <Route path="/login" element={<Login />} />
            </Routes>
          </MemoryRouter>
        </CartProvider>
      </SearchProvider>
    </AuthProvider>,
  );

describe("[Integration] Guest checkout login redirect", () => {
  beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(() => {
    axios.get.mockReset();
    axios.post.mockReset();
    axios.defaults = { headers: { common: {} } };
    localStorage.clear();
    localStorage.setItem("cart", JSON.stringify([CART_ITEM]));
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
    mockDropInInstance.requestPaymentMethod.mockReset();
    toast.success = mockToastSuccess;
    toast.error = mockToastError;

    axios.get.mockImplementation((url) => {
      switch (url) {
        case "/api/v1/category/get-category":
          return Promise.resolve({
            data: { success: true, category: [] },
          });
        case "/api/v1/product/braintree/token":
          return Promise.resolve({
            data: { clientToken: "client-token-123" },
          });
        default:
          return Promise.reject(new Error(`Unhandled GET request: ${url}`));
      }
    });

    axios.post.mockImplementation((url, payload) => {
      if (url === "/api/v1/auth/login") {
        expect(payload).toEqual({
          email: "checkout@test.com",
          password: "secret123",
        });

        return Promise.resolve(LOGIN_RESPONSE);
      }

      return Promise.reject(new Error(`Unhandled POST request: ${url}`));
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("redirects guests to login, returns to cart after successful authentication, and reveals checkout UI", async () => {
    // Summary: Verifies the guest checkout redirect preserves cart state and restores checkout access after login.
    // Flow: open cart as guest -> click login-to-checkout -> assert redirect state -> submit credentials -> assert return to cart with auth, address, drop-in, and payment button.
    // Arrange + Act
    renderLoginCheckoutFlow();

    // Assert
    await waitFor(() => {
      expect(screen.getByText("Hello Guest")).toBeInTheDocument();
      expect(screen.getByText("Checkout Keyboard")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Plase Login to checkout" }),
      ).toBeInTheDocument();
    });

    // Act
    const loginToCheckoutButton = screen.getByRole("button", {
      name: "Plase Login to checkout",
    });
    await userEvent.click(loginToCheckoutButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
      expect(screen.getByTestId("current-state")).toHaveTextContent("/cart");
      expect(
        screen.getByRole("heading", { name: /login form/i }),
      ).toBeInTheDocument();
    });

    // Act
    await userEvent.type(
      screen.getByPlaceholderText(/enter your email/i),
      "checkout@test.com",
    );
    await userEvent.type(
      screen.getByPlaceholderText(/enter your password/i),
      "secret123",
    );
    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/v1/auth/login", {
        email: "checkout@test.com",
        password: "secret123",
      });
      expect(screen.getByTestId("current-path")).toHaveTextContent("/cart");
      expect(localStorage.getItem("auth")).toContain("token-123");
      expect(axios.defaults.headers.common["Authorization"]).toBe("token-123");
      expect(screen.getByText(/Hello\s+Checkout User/)).toBeInTheDocument();
      expect(screen.getByText(/You Have 1 items in your cart/i)).toBeInTheDocument();
      expect(screen.getByText("Checkout Keyboard")).toBeInTheDocument();
      expect(screen.getByText(/Total : \$129\.00/i)).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem("cart"))).toEqual([CART_ITEM]);
      expect(screen.getByText("123 Payment Street")).toBeInTheDocument();
      expect(screen.getByTestId("dropin")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Make Payment" }),
      ).toBeEnabled();
    });
  });

  it("removes an item from the cart and updates the empty-cart state", async () => {
    // Summary: Verifies cart removal updates both the rendered checkout state and persisted cart storage.
    // Flow: seed guest cart -> render cart page -> click Remove -> assert empty-cart UI and empty stored cart.
    renderLoginCheckoutFlow();

    await waitFor(() => {
      expect(screen.getByText("Checkout Keyboard")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /remove/i }));

    await waitFor(() => {
      expect(screen.getByText(/Your Cart Is Empty/i)).toBeInTheDocument();
      expect(screen.getByText(/Total : \$0\.00/i)).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem("cart"))).toEqual([]);
    });
  });

  it("shows the update address button when an authenticated shopper has no saved address", async () => {
    // Summary: Verifies checkout remains gated when the authenticated user profile does not contain an address.
    // Flow: seed auth without address plus cart item -> render cart page -> assert Update Address button is shown and payment button stays hidden.
    localStorage.setItem("auth", JSON.stringify(AUTH_WITHOUT_ADDRESS));

    renderLoginCheckoutFlow();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /update address/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /make payment/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("handles malformed cart JSON gracefully without showing a user-facing error", async () => {
    // Summary: Verifies invalid cart JSON falls back to an empty cart instead of crashing the checkout page.
    // Flow: seed malformed cart JSON -> render cart page -> assert guest empty-cart UI renders and cart item text is absent.
    localStorage.setItem("cart", "{bad json");

    renderLoginCheckoutFlow();

    await waitFor(() => {
      expect(screen.getByText("Hello Guest")).toBeInTheDocument();
      expect(screen.getByText(/Your Cart Is Empty/i)).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /cart summary/i }),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(CART_ITEM.name)).not.toBeInTheDocument();
  });
});
