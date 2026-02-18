//
// Tan Wei Lian, A0269750U
//
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "@testing-library/jest-dom";
import CreateCategory from "./CreateCategory";

jest.mock("axios");
jest.mock("react-hot-toast");

jest.mock("antd", () => {
  const React = require("react");
  const Modal = ({ children, visible, onCancel }) =>
    visible
      ? React.createElement("div", { "data-testid": "modal" }, children)
      : null;
  const Badge = ({ children }) => React.createElement("span", null, children);
  return { Modal, Badge };
});

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(() => [null, jest.fn()]),
}));
jest.mock("../../context/cart", () => ({
  useCart: jest.fn(() => [null, jest.fn()]),
}));
jest.mock("../../context/search", () => ({
  useSearch: jest.fn(() => [{ keyword: "" }, jest.fn()]),
}));
jest.mock("../../hooks/useCategory", () => jest.fn(() => []));

window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };

describe("CreateCategory", () => {
  const mockCategories = [
    { _id: "1", name: "Electronics" },
    { _id: "2", name: "Books" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({
      data: { success: true, category: mockCategories },
    });
  });

  test("should render heading and fetch categories on mount", async () => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );

    // Assert
    expect(screen.getByText("Manage Category")).toBeInTheDocument();
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
    });
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });
    expect(screen.getByText("Books")).toBeInTheDocument();
  });

  test("should display categories in a table with Edit and Delete buttons", async () => {
    // Arrange & Act
    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    const deleteButtons = screen.getAllByText("Delete");
    expect(editButtons).toHaveLength(2);
    expect(deleteButtons).toHaveLength(2);
  });

  test("should create a new category successfully", async () => {
    // Arrange
    axios.post.mockResolvedValue({ data: { success: true } });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act
    const input = screen.getByPlaceholderText("Enter new category");
    fireEvent.change(input, { target: { value: "Clothing" } });
    const submitButtons = screen.getAllByText("Submit");
    fireEvent.click(submitButtons[0]);

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "/api/v1/category/create-category",
        { name: "Clothing" }
      );
    });
    expect(toast.success).toHaveBeenCalledWith("Clothing is created");
  });

  test("should show error toast when create returns success: false", async () => {
    // Arrange
    axios.post.mockResolvedValue({
      data: { success: false, message: "Category already exists" },
    });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act
    const input = screen.getByPlaceholderText("Enter new category");
    fireEvent.change(input, { target: { value: "Electronics" } });
    fireEvent.click(screen.getAllByText("Submit")[0]);

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Category already exists");
    });
  });

  test("should show error toast when create throws an exception", async () => {
    // Arrange
    axios.post.mockRejectedValue(new Error("Network error"));

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act
    const input = screen.getByPlaceholderText("Enter new category");
    fireEvent.change(input, { target: { value: "Clothing" } });
    fireEvent.click(screen.getAllByText("Submit")[0]);

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Something went wrong in input form"
      );
    });
  });

  test("should delete a category successfully", async () => {
    // Arrange
    axios.delete.mockResolvedValue({ data: { success: true } });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act
    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    // Assert
    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith(
        "/api/v1/category/delete-category/1"
      );
    });
    expect(toast.success).toHaveBeenCalledWith("category is deleted");
  });

  test("should show error toast when delete returns success: false", async () => {
    // Arrange
    axios.delete.mockResolvedValue({
      data: { success: false, message: "Cannot delete" },
    });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getAllByText("Delete")[0]);

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Cannot delete");
    });
  });

  test("should show error toast when delete throws an exception", async () => {
    // Arrange
    axios.delete.mockRejectedValue(new Error("Network error"));

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getAllByText("Delete")[0]);

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Something went wrong");
    });
  });

  test("should open edit modal when Edit is clicked", async () => {
    // Arrange
    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getAllByText("Edit")[0]);

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId("modal")).toBeInTheDocument();
    });
  });

  test("should update a category successfully via the edit modal", async () => {
    // Arrange
    axios.put.mockResolvedValue({ data: { success: true } });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act — open modal
    fireEvent.click(screen.getAllByText("Edit")[0]);
    await waitFor(() => {
      expect(screen.getByTestId("modal")).toBeInTheDocument();
    });

    // Change the name in the modal input
    const inputs = screen.getAllByPlaceholderText("Enter new category");
    const modalInput = inputs[inputs.length - 1];
    fireEvent.change(modalInput, { target: { value: "Updated Electronics" } });

    // Submit the modal form
    const submitButtons = screen.getAllByText("Submit");
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    // Assert
    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        "/api/v1/category/update-category/1",
        { name: "Updated Electronics" }
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Updated Electronics is updated"
    );
  });

  test("should show error toast when update returns success: false", async () => {
    // Arrange
    axios.put.mockResolvedValue({
      data: { success: false, message: "Update failed" },
    });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getAllByText("Edit")[0]);
    await waitFor(() => {
      expect(screen.getByTestId("modal")).toBeInTheDocument();
    });
    const submitButtons = screen.getAllByText("Submit");
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update failed");
    });
  });

  test("should show error toast when update throws an exception", async () => {
    // Arrange
    axios.put.mockRejectedValue(new Error("Network error"));

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getAllByText("Edit")[0]);
    await waitFor(() => {
      expect(screen.getByTestId("modal")).toBeInTheDocument();
    });
    const submitButtons = screen.getAllByText("Submit");
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Something went wrong");
    });
  });

  test("should submit empty name when input is not filled", async () => {
    // Arrange
    axios.post.mockResolvedValue({ data: { success: true } });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Act — click submit without filling input
    fireEvent.click(screen.getAllByText("Submit")[0]);

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "/api/v1/category/create-category",
        { name: "" }
      );
    });
  });

  test("should not set categories when getAllCategory returns success: false", async () => {
    // Arrange
    axios.get.mockResolvedValue({
      data: { success: false },
    });

    // Act
    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );

    // Assert — no category rows in table
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
    });
    expect(screen.queryByText("Electronics")).not.toBeInTheDocument();
    expect(screen.queryByText("Books")).not.toBeInTheDocument();
  });

  test("should show error toast when fetching categories fails", async () => {
    // Arrange
    axios.get.mockRejectedValue(new Error("Network error"));

    // Act
    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Something went wrong in getting category"
      );
    });
  });
});
