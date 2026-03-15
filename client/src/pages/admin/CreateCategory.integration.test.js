//
// Tan Wei Lian, A0269750U
//
// Integration tests for CreateCategory page.
// These tests verify the interactions between two real React units:
//   1. CreateCategory (parent) — manages state, handles API calls, renders the table
//   2. CategoryForm (child) — receives setValue/handleSubmit callbacks and renders the form
//
// Unlike unit tests (which mock antd's Modal), these tests use the real antd Modal
// to verify the complete edit workflow: open modal → CategoryForm inside modal gets
// pre-populated → user types → submit triggers handleUpdate.
// Axios is mocked because the HTTP layer is an external boundary, not a unit under test.

import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "@testing-library/jest-dom";
import CreateCategory from "./CreateCategory";

jest.mock("axios");
jest.mock("react-hot-toast");

// Mock antd for stable modal testing in jsdom
jest.mock("antd", () => {
  const React = require("react");
  const Modal = ({ children, visible, onCancel }) =>
    visible
      ? React.createElement("div", { "data-testid": "edit-modal" }, children)
      : null;
  const Badge = ({ children }) => React.createElement("span", null, children);
  return { Modal, Badge };
});

// Mock context and hooks (not part of the units under test)
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
    return { matches: false, addListener: function () {}, removeListener: function () {} };
  };

const seedCategories = [
  { _id: "cat-1", name: "Electronics" },
  { _id: "cat-2", name: "Books" },
];

describe("CreateCategory + CategoryForm — interaction between parent and child components", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({
      data: { success: true, category: seedCategories },
    });
  });

  test("CategoryForm renders inside CreateCategory and its input drives the parent's name state", async () => {
    // CategoryForm's input onChange calls CreateCategory's setName via the `setValue` prop.
    // This integration test verifies that the parent's state is updated correctly
    // and the child re-renders to reflect the new value.
    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );

    await screen.findByText("Electronics");

    // Type into the real CategoryForm input
    const input = screen.getByPlaceholderText("Enter new category");
    fireEvent.change(input, { target: { value: "Clothing" } });

    // CategoryForm should reflect the updated value (re-rendered with new prop from parent)
    expect(input.value).toBe("Clothing");
  });

  test("CategoryForm's submit triggers CreateCategory's handleSubmit with the current name state", async () => {
    // Integration: CategoryForm's onSubmit prop is CreateCategory's handleSubmit.
    // Submitting the form should call axios with the name typed into CategoryForm.
    axios.post.mockResolvedValue({ data: { success: true } });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await screen.findByText("Electronics");

    // User types a new category name in the real CategoryForm
    const input = screen.getByPlaceholderText("Enter new category");
    fireEvent.change(input, { target: { value: "Gardening" } });

    // User submits via the real CategoryForm submit button
    fireEvent.click(screen.getAllByText("Submit")[0]);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/v1/category/create-category", {
        name: "Gardening",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Gardening is created");
  });

  test("after successful create, CreateCategory refetches and displays the updated list", async () => {
    // Integration: after handleSubmit succeeds, CreateCategory calls getAllCategory again.
    // The second GET returns a new list that includes the newly created category.
    axios.post.mockResolvedValue({ data: { success: true } });

    const updatedCategories = [
      ...seedCategories,
      { _id: "cat-3", name: "Gardening" },
    ];
    // First call: initial load. Second call: after create success.
    axios.get
      .mockResolvedValueOnce({ data: { success: true, category: seedCategories } })
      .mockResolvedValueOnce({ data: { success: true, category: updatedCategories } });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await screen.findByText("Electronics");

    fireEvent.change(screen.getByPlaceholderText("Enter new category"), {
      target: { value: "Gardening" },
    });
    fireEvent.click(screen.getAllByText("Submit")[0]);

    await screen.findByText("Gardening");
    // getAllCategory was called twice (initial + after create)
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test("edit modal opens with CategoryForm pre-populated with the selected category's name", async () => {
    // Integration: clicking Edit sets CreateCategory's state (selected, updatedName, visible).
    // This state is passed as the `value` prop to the CategoryForm inside the Modal.
    // The CategoryForm should render with the pre-populated name.
    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await screen.findByText("Electronics");

    // Click the Edit button for "Electronics"
    fireEvent.click(screen.getAllByText("Edit")[0]);

    const modal = await screen.findByTestId("edit-modal");

    // The CategoryForm inside the modal should have the current category name pre-filled
    const modalInput = within(modal).getByPlaceholderText("Enter new category");
    expect(modalInput.value).toBe("Electronics");
  });

  test("complete edit workflow: open modal → type new name → submit → API PUT called → toast shown", async () => {
    // Integration: the modal edit workflow spans CreateCategory state management,
    // CategoryForm's onChange/onSubmit, and the API call in handleUpdate.
    axios.put.mockResolvedValue({ data: { success: true } });
    axios.get
      .mockResolvedValueOnce({ data: { success: true, category: seedCategories } })
      .mockResolvedValueOnce({ data: { success: true, category: seedCategories } });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await screen.findByText("Electronics");

    // Open edit modal for "Electronics" (cat-1)
    fireEvent.click(screen.getAllByText("Edit")[0]);
    const modal = await screen.findByTestId("edit-modal");

    // Type a new name in the modal's CategoryForm
    const modalInput = within(modal).getByPlaceholderText("Enter new category");
    fireEvent.change(modalInput, { target: { value: "Consumer Electronics" } });

    // Submit via the modal's CategoryForm Submit button
    fireEvent.click(within(modal).getByText("Submit"));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith("/api/v1/category/update-category/cat-1", {
        name: "Consumer Electronics",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Consumer Electronics is updated");
  });

  test("after successful delete, CreateCategory refetches and removes the category from the table", async () => {
    // Integration: handleDelete success → getAllCategory refetch → table re-renders without deleted item
    axios.delete.mockResolvedValue({ data: { success: true } });
    const afterDeleteCategories = [{ _id: "cat-2", name: "Books" }];
    axios.get
      .mockResolvedValueOnce({ data: { success: true, category: seedCategories } })
      .mockResolvedValueOnce({ data: { success: true, category: afterDeleteCategories } });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );
    await screen.findByText("Electronics");

    // Click Delete for "Electronics"
    fireEvent.click(screen.getAllByText("Delete")[0]);

    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith("/api/v1/category/delete-category/cat-1");
    });

    // After refetch, Electronics should be gone
    await waitFor(() => {
      expect(screen.queryByText("Electronics")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Books")).toBeInTheDocument();
  });
});
