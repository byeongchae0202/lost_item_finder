import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LostItemDetailView from "./lost-item-detail-view";

const detail = {
  id: "item-1",
  title: "검은색 지갑",
  category: "지갑/카드",
  location: "중앙 도서관",
  description: "파란 키링",
  foundDate: "2026-10-24",
  photoPaths: [],
  custodyStatus: "held_by_finder",
  isOwner: true,
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => detail }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("lost item detail custody status", () => {
  it("shows current status and lets the owner save a new status", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation((_input, init) => Promise.resolve({
      ok: true,
      json: async () => init?.method === "PATCH"
        ? { id: detail.id, custodyStatus: "department_office" }
        : detail,
    } as Response));
    render(<LostItemDetailView itemId="item-1" />);

    await screen.findByRole("heading", { name: "검은색 지갑" });
    expect(document.querySelector(".custody-badge")?.textContent).toContain("습득자가 보관 중");
    const statusSelect = screen.getByLabelText("보관 상태 수정");
    fireEvent.change(statusSelect, { target: { value: "department_office" } });
    fireEvent.submit(statusSelect.closest("form")!);

    await screen.findByText("보관 상태를 저장했습니다.");
    expect(document.querySelector(".custody-badge")?.textContent).toContain("학과 사무실에 맡김");
    expect(fetchMock).toHaveBeenCalledWith("/api/lost-items/item-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ custodyStatus: "department_office" }),
    });
  });

  it("distinguishes completed delivery and hides the edit control", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...detail, custodyStatus: "returned" }),
    }));
    render(<LostItemDetailView itemId="item-1" />);

    await screen.findByText("주인에게 전달 완료");
    expect(screen.getByText("주인에게 전달 완료").className).toContain("custody-returned");
    expect(screen.queryByLabelText("보관 상태 수정")).toBeNull();
  });
});
