import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Home from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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

  it("opens the private lost report form with required fields", () => {
    render(<Home />);
    fireEvent.click(screen.getAllByRole("button", { name: /분실 신고/ })[0]);

    const dialog = screen.getByRole("dialog", { name: "분실 신고" });
    const form = within(dialog);
    expect(dialog).toBeTruthy();
    expect(form.getByRole("textbox", { name: /물품명/ })).toBeTruthy();
    expect(form.getByRole("textbox", { name: /분실 장소/ })).toBeTruthy();
    expect(form.getByLabelText(/분실 날짜/)).toBeTruthy();
  });
});
