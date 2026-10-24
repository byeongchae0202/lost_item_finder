import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("app shell", () => {
  it("renders the root main landmark", () => {
    render(<Home />);

    expect(screen.getByRole("main")).toBeTruthy();
  });
});
