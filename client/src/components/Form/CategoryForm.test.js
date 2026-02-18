//
// Tan Wei Lian, A0269750U
//
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import CategoryForm from "./CategoryForm";

describe("CategoryForm", () => {
  let mockHandleSubmit;
  let mockSetValue;

  beforeEach(() => {
    mockHandleSubmit = jest.fn((e) => e.preventDefault());
    mockSetValue = jest.fn();
  });

  test("should render input with placeholder and Submit button", () => {
    // Arrange & Act
    render(
      <CategoryForm
        handleSubmit={mockHandleSubmit}
        value=""
        setValue={mockSetValue}
      />
    );

    // Assert
    expect(
      screen.getByPlaceholderText("Enter new category")
    ).toBeInTheDocument();
    expect(screen.getByText("Submit")).toBeInTheDocument();
  });

  test("should display the provided value in the input field", () => {
    // Arrange
    const testValue = "Electronics";

    // Act
    render(
      <CategoryForm
        handleSubmit={mockHandleSubmit}
        value={testValue}
        setValue={mockSetValue}
      />
    );

    // Assert
    expect(screen.getByPlaceholderText("Enter new category")).toHaveValue(
      "Electronics"
    );
  });

  test("should call setValue when input text changes", () => {
    // Arrange
    render(
      <CategoryForm
        handleSubmit={mockHandleSubmit}
        value=""
        setValue={mockSetValue}
      />
    );

    // Act
    fireEvent.change(screen.getByPlaceholderText("Enter new category"), {
      target: { value: "Books" },
    });

    // Assert
    expect(mockSetValue).toHaveBeenCalledWith("Books");
  });

  test("should call handleSubmit when form is submitted", () => {
    // Arrange
    render(
      <CategoryForm
        handleSubmit={mockHandleSubmit}
        value="Test"
        setValue={mockSetValue}
      />
    );

    // Act
    fireEvent.click(screen.getByText("Submit"));

    // Assert
    expect(mockHandleSubmit).toHaveBeenCalledTimes(1);
  });

  test("should render correctly with special characters in value", () => {
    // Arrange
    const specialValue = "<script>alert('xss')</script>";

    // Act
    render(
      <CategoryForm
        handleSubmit={mockHandleSubmit}
        value={specialValue}
        setValue={mockSetValue}
      />
    );

    // Assert
    expect(screen.getByPlaceholderText("Enter new category")).toHaveValue(
      specialValue
    );
  });

  test("should not crash when handleSubmit is undefined", () => {
    // Arrange & Act & Assert — rendering without handleSubmit should not throw
    expect(() =>
      render(
        <CategoryForm
          value="Test"
          setValue={mockSetValue}
        />
      )
    ).not.toThrow();
  });

  test("should have correct input type and button type attributes", () => {
    // Arrange & Act
    render(
      <CategoryForm
        handleSubmit={mockHandleSubmit}
        value=""
        setValue={mockSetValue}
      />
    );

    // Assert
    const input = screen.getByPlaceholderText("Enter new category");
    expect(input).toHaveAttribute("type", "text");

    const button = screen.getByText("Submit");
    expect(button).toHaveAttribute("type", "submit");
  });
});
