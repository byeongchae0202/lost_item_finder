import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LostReportMatchesView from "./lost-report-matches-view";

const response = {
  report: {
    id: "report-1",
    title: "검정색 태블릿",
    category: "전자기기",
    location: "공학관",
    lostDate: "2026-10-24",
    description: "파란 커버",
    photoCount: 0,
  },
  matches: [
    {
      itemId: "found-1",
      title: "검정색 태블릿 검증",
      category: "전자기기",
      location: "제1공학관",
      foundDate: "2026-10-24",
      description: "파란 커버와 스티커",
      thumbnailUrl: null,
      photoCount: 0,
      score: 65,
      dayDifference: 0,
      reasons: ["날짜 근접 +30", "장소 유사 +20", "공통 키워드 3개 +15"],
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => response }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("lost report match results", () => {
  it("shows private report and matching candidates with a detail action", async () => {
    render(<LostReportMatchesView reportId="report-1" />);

    await screen.findAllByRole("heading", { name: "검정색 태블릿 검증" });
    expect(screen.getByText("일치도")).toBeTruthy();
    expect(screen.getByText("공통 키워드 3개 +15")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /후보 확인/ }));
    expect(screen.getByRole("dialog", { name: "후보 상세" })).toBeTruthy();
    expect(screen.getByText("매칭 정보")).toBeTruthy();
  });

  it("shows an empty state when no candidates are returned", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...response, matches: [] }),
    }));
    render(<LostReportMatchesView reportId="report-1" />);

    await waitFor(() => expect(screen.getByText("아직 비슷한 습득물이 없어요.")).toBeTruthy());
  });

  it("hides a candidate after the owner confirms they found it", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation((_input, init) => Promise.resolve({
      ok: true,
      json: async () => init?.method === "POST" ? { resolved: true } : response,
    } as Response));
    render(<LostReportMatchesView reportId="report-1" />);
    await screen.findAllByRole("heading", { name: "검정색 태블릿 검증" });

    fireEvent.click(screen.getByRole("button", { name: /후보 확인/ }));
    await screen.findByRole("dialog", { name: "후보 상세" });
    fireEvent.click(screen.getByRole("button", { name: "찾았어요" }));
    expect(screen.getByText("확인하면 이 습득물 게시물이 전체 목록에서 사라집니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "목록에서 숨기기" }));

    await screen.findByText("찾은 물건을 습득물 목록에서 숨겼습니다.");
    await waitFor(() => expect(document.querySelectorAll(".match-card")).toHaveLength(0));
    expect(screen.queryByRole("dialog", { name: "후보 상세" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/lost-reports/report-1/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: "found-1" }),
    });
  });

  it("does not display private data when the owner cookie is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    render(<LostReportMatchesView reportId="report-1" />);

    await screen.findByRole("alert");
    expect(screen.getByText("신고를 확인할 수 없어요.")).toBeTruthy();
  });
});
