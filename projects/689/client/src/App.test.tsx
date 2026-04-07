import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

describe("App", () => {
  it("renders without crashing", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
  });

  it("renders home route content on default route", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    const mainElement =
      screen.queryByRole("main") ||
      screen.queryByTestId("home-page") ||
      screen.queryByText(/home/i);

    expect(mainElement).toBeTruthy();
  });

  it("renders not-found or fallback content for unknown route", () => {
    render(
      <MemoryRouter initialEntries={["/some-unknown-route"]}>
        <App />
      </MemoryRouter>
    );

    const notFoundElement =
      screen.queryByText(/not found/i) ||
      screen.queryByTestId("not-found-page") ||
      screen.queryRole?.("alert") ||
      screen.queryByText(/404/i);

    expect(notFoundElement).toBeTruthy();
  });
});