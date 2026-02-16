import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import SearchInput from "./SearchInput";
import { useSearch } from "../../context/search";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Mocks
jest.mock("../../context/search", () => ({
  useSearch: jest.fn(),
}));

jest.mock("axios");

jest.mock("react-router-dom", () => ({
  useNavigate: jest.fn(),
}));

describe("SearchInput component", () => {
  const setValuesMock = jest.fn();
  const navigateMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useNavigate.mockReturnValue(navigateMock);
  });

  it("updates keyword on input change", () => {
    useSearch.mockReturnValue([{ keyword: "", results: [] }, setValuesMock]);

    render(<SearchInput />);

    const input = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(input, { target: { value: "iphone" } });

    expect(setValuesMock).toHaveBeenCalledWith({
      keyword: "iphone",
      results: [],
    });
  });

  it("submits search, sets results, and navigates to /search", async () => {
    const values = { keyword: "iphone", results: [] };
    useSearch.mockReturnValue([values, setValuesMock]);

    axios.get.mockResolvedValueOnce({
      data: [{ _id: "1", name: "Phone" }],
    });

    render(<SearchInput />);

    fireEvent.click(screen.getByRole("button", { name: /Search/i }));

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    expect(axios.get).toHaveBeenCalledWith("/api/v1/product/search/iphone");

    expect(setValuesMock).toHaveBeenCalledWith({
      ...values,
      results: [{ _id: "1", name: "Phone" }],
    });

    expect(navigateMock).toHaveBeenCalledWith("/search");
  });

  it("handles axios error (logs) without crashing", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    useSearch.mockReturnValue([{ keyword: "bad", results: [] }, setValuesMock]);

    axios.get.mockRejectedValueOnce(new Error("Network error"));

    render(<SearchInput />);

    fireEvent.click(screen.getByRole("button", { name: /Search/i }));

    await waitFor(() => expect(logSpy).toHaveBeenCalled());
    expect(navigateMock).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
