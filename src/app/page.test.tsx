import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Home from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("app shell", () => {
  it("renders the root main landmark", () => {
    render(<Home />);

    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /습득물/ })).toBeTruthy();
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

  it("lets the poster confirm deletion and removes the item from the board", async () => {
    const ownedItem = {
      id: "owned-1",
      title: "검은색 지갑",
      category: "지갑/카드",
      location: "도서관",
      description: "파란 키링",
      foundDate: "2026-10-20",
      photoPaths: [],
      createdAt: "2026-10-20T10:00:00.000Z",
      isOwner: true,
    };
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve((init?.method === "DELETE"
        ? { ok: true, json: async () => ({ deleted: true }) }
        : { ok: true, json: async () => [ownedItem] }) as Response),
    );
    render(<Home />);

    const deleteButton = await screen.findByRole("button", { name: "검은색 지갑 게시물 삭제" });
    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "검은색 지갑" })).toBeNull());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/lost-items/owned-1", { method: "DELETE" });
  });
});
