// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashReportOwnerToken, reportOwnerCookieName } from "@/lib/lost-reports/ownership";

const { getLostReportMock, getAllLostItemsMock } = vi.hoisted(() => ({
  getLostReportMock: vi.fn(),
  getAllLostItemsMock: vi.fn(),
}));

vi.mock("@/lib/lost-items/database", () => ({
  getLostReport: getLostReportMock,
  getAllLostItems: getAllLostItemsMock,
}));

import { GET } from "./route";

const reportId = "123e4567-e89b-12d3-a456-426614174000";
const ownerToken = "a".repeat(43);

function savedReport() {
  return {
    id: reportId,
    title: "검은색 아이패드",
    category: "전자기기",
    location: "공학관",
    lostDate: "2026-10-20",
    description: "파란 케이스",
    photoPaths: [],
    ownerTokenHash: hashReportOwnerToken(ownerToken),
    createdAt: "2026-10-20T10:00:00.000Z",
  };
}

function makeRequest(id = reportId, token?: string) {
  const headers = token
    ? { cookie: `${reportOwnerCookieName(id)}=${token}` }
    : undefined;
  return new NextRequest(`http://localhost/api/lost-reports/${id}/matches`, { headers });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("private lost report matches route", () => {
  it("returns report and matches to the owner without exposing private data", async () => {
    getLostReportMock.mockReturnValue(savedReport());
    getAllLostItemsMock.mockReturnValue([
      {
        id: "found-1",
        title: "아이패드",
        category: "전자기기",
        location: "제1공학관",
        description: "파란 케이스",
        foundDate: "2026-10-21",
        photoPaths: ["photo.png"],
        createdAt: "2026-10-21T10:00:00.000Z",
      },
    ]);

    const response = await GET(makeRequest(reportId, ownerToken), {
      params: Promise.resolve({ id: reportId }),
    });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(result.report.id).toBe(reportId);
    expect(result.matches).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("ownerTokenHash");
    expect(JSON.stringify(result)).not.toContain("photoPaths");
  });

  it.each([undefined, "b".repeat(43)])("hides report existence from non-owners", async (token) => {
    getLostReportMock.mockReturnValue(savedReport());

    const response = await GET(makeRequest(reportId, token), {
      params: Promise.resolve({ id: reportId }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getAllLostItemsMock).not.toHaveBeenCalled();
  });

  it("rejects malformed report IDs before accessing storage", async () => {
    const response = await GET(makeRequest("not-a-uuid", ownerToken), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(response.status).toBe(404);
    expect(getLostReportMock).not.toHaveBeenCalled();
  });
});