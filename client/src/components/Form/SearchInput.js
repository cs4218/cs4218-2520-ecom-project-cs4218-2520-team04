//
// Lu Yixuan, Deborah, A0277911X
//
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SearchInput from "./SearchInput";
import { useSearch } from "../../context/search";
import axios from "axios";
import { useNavigate } from "react-router-dom";

jest.mock("../../context/search", () => ({
  useSearch: jest.fn(),
}));

jest.mock("axios");

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

describe("SearchInput (unit/component)", () => {
  const setValuesMock = jest.fn();
  const navigateMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useNavigate.mockReturnValue(navigateMock);
  });

  test("Given empty keyword, When typing, Then it updates keyword via setValues", () => {
    // Given
    useSearch.mockReturnValue([{ keyword: "", results: [] }, setValuesMock]);

    // When
    render(<SearchInput />);
    fireEvent.change(screen.getByPlaceholderText(/Search/i), {
      target: { value: "iphone" },
    });

    // Then
    expect(setValuesMock).toHaveBeenCalledWith({
      keyword: "iphone",
      results: [],
    });
  });

  test("Given keyword, When submit succeeds, Then it fetches, sets results, and navigates", async () => {
    // Given
    const values = { keyword: "iphone", results: [] };
    useSearch.mockReturnValue([values, setValuesMock]);

    axios.get.mockResolvedValueOnce({
      data: [{ _id: "1", name: "Phone" }],
    });

    // When
    render(<SearchInput />);
    fireEvent.submit(screen.getByRole("search")); // tests form submit (enter/click equivalent)

    // Then
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    expect(axios.get).toHaveBeenCalledWith("/api/v1/product/search/iphone");

    expect(setValuesMock).toHaveBeenCalledWith({
      ...values,
      results: [{ _id: "1", name: "Phone" }],
    });

    expect(navigateMock).toHaveBeenCalledWith("/search");
  });

  test("Given axios error, When submit fails, Then it logs and does not navigate", async () => {
    // Given
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    useSearch.mockReturnValue([{ keyword: "bad", results: [] }, setValuesMock]);
    axios.get.mockRejectedValueOnce(new Error("Network error"));

    // When
    render(<SearchInput />);
    fireEvent.submit(screen.getByRole("search"));

    // Then
    await waitFor(() => expect(logSpy).toHaveBeenCalled());
    expect(navigateMock).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
