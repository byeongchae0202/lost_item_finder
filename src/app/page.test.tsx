import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Home from "./page";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("app shell", () => {
  it("renders the root main landmark", () => {
    render(<Home />);

    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /찾는 사람과/ })).toBeTruthy();
  });

  it("defaults new registrations to today and disallows future dates", () => {
    render(<Home />);
    fireEvent.click(screen.getAllByRole("button", { name: "습득물 등록" })[0]);

    const dateInput = screen.getByLabelText(/습득 날짜/);
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);

    expect(dateInput).toHaveProperty("value", today);
    expect(dateInput.getAttribute("max")).toBe(today);
  });
});
