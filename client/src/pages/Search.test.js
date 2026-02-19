//
// Lu Yixuan, Deborah, A0277911X
//
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SearchProvider, useSearch } from "../context/search";

const Consumer = () => {
  const [values, setValues] = useSearch();
  return (
    <div>
      <div data-testid="keyword">{values.keyword}</div>
      <div data-testid="results-len">{values.results.length}</div>
      <button onClick={() => setValues({ keyword: "abc", results: [1, 2] })}>
        set
      </button>
    </div>
  );
};

describe("SearchContext (unit)", () => {
  test("Given SearchProvider, When Consumer renders, Then it provides default values", () => {
    // Given / When
    render(
      <SearchProvider>
        <Consumer />
      </SearchProvider>
    );

    // Then
    expect(screen.getByTestId("keyword")).toHaveTextContent("");
    expect(screen.getByTestId("results-len")).toHaveTextContent("0");
  });

  test("Given SearchProvider, When setValues is called, Then values update", () => {
    // Given
    render(
      <SearchProvider>
        <Consumer />
      </SearchProvider>
    );

    // When
    fireEvent.click(screen.getByRole("button", { name: /set/i }));

    // Then
    expect(screen.getByTestId("keyword")).toHaveTextContent("abc");
    expect(screen.getByTestId("results-len")).toHaveTextContent("2");
  });

  test("Given useSearch is used without provider, When rendered, Then it throws a helpful error", () => {
    // Given: a component using the hook without provider
    const BadConsumer = () => {
      useSearch();
      return null;
    };

    // When / Then
    expect(() => render(<BadConsumer />)).toThrow(
      "useSearch must be used within a SearchProvider"
    );
  });
});
