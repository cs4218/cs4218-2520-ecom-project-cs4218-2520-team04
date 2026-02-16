import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { SearchProvider, useSearch } from "./search";

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

describe("SearchContext", () => {
  it("provides default values", () => {
    render(
      <SearchProvider>
        <Consumer />
      </SearchProvider>
    );

    expect(screen.getByTestId("keyword")).toHaveTextContent("");
    expect(screen.getByTestId("results-len")).toHaveTextContent("0");
  });

  it("allows updating values via setValues", () => {
    render(
      <SearchProvider>
        <Consumer />
      </SearchProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /set/i }));

    expect(screen.getByTestId("keyword")).toHaveTextContent("abc");
    expect(screen.getByTestId("results-len")).toHaveTextContent("2");
  });
});
