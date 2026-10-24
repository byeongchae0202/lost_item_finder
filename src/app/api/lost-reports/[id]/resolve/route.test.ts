// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashReportOwnerToken, reportOwnerCookieName } from "@/lib/lost-reports/ownership";

const { getAllLostItemsMock, getLostReportMock, getLostItemsDatabaseMock, resolveLostItemForReportMock, deleteStoredPhotoFilesMock } = vi.hoisted(() => ({
  getAllLostItemsMock: vi.fn(),
  getLostReportMock: vi.fn(),
  getLostItemsDatabaseMock: vi.fn(() => ({})),
  resolveLostItemForReportMock: vi.fn(),
  deleteStoredPhotoFilesMock: vi.fn(),
}));

vi.mock("@/lib/lost-items/database", () => ({
  getAllLostItems: getAllLostItemsMock,
  getLostReport: getLostReportMock,
  getLostItemsDatabase: getLostItemsDatabaseMock,
  resolveLostItemForReport: resolveLostItemForReportMock,
}));
vi.mock("@/lib/lost-items/photos", () => ({
  deleteStoredPhotoFiles: deleteStoredPhotoFilesMock,
}));

import { POST } from "./route";

const reportId = "123e4567-e89b-12d3-a456-426614174000";
const itemId = "223e4567-e89b-12d3-a456-426614174000";
const ownerToken = "a".repeat(43);
const report = {
  id: reportId,
  title: "검정색 태블릿",
  category: "전자기기",
  location: "공학관",
  lostDate: "2026-10-20",
  description: "파란 케이스",
  photoPaths: [],
  ownerTokenHash: hashReportOwnerToken(ownerToken),
  createdAt: "2026-10-20T10:00:00.000Z",
};
const item = {
  id: itemId,
  title: "검정색 태블릿",
  category: "전자기기",
  location: "제1공학관",
  description: "파란 케이스",
  foundDate: "2026-10-20",
  photoPaths: ["found.png"],
  createdAt: "2026-10-20T11:00:00.000Z",
};

afterEach(() => vi.resetAllMocks());

describe("lost report resolve route", () => {
  it("lets the report owner mark a matched item as found and hides it", async () => {
    getLostReportMock.mockReturnValue(report);
    getAllLostItemsMock.mockReturnValue([item]);
    resolveLostItemForReportMock.mockReturnValue(["found.png"]);
    const request = new NextRequest(`http://localhost/api/lost-reports/${reportId}/resolve`, {
      method: "POST",
      headers: {
        cookie: `${reportOwnerCookieName(reportId)}=${ownerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ itemId }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: reportId }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ resolved: true });
    expect(resolveLostItemForReportMock).toHaveBeenCalledWith(expect.anything(), itemId, reportId, report.ownerTokenHash);
    expect(deleteStoredPhotoFilesMock).toHaveBeenCalledWith(["found.png"]);
  });

  it("rejects non-owner requests and non-matching items", async () => {
    getLostReportMock.mockReturnValue(report);
    const unauthorized = await POST(
      new NextRequest(`http://localhost/api/lost-reports/${reportId}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId }),
      }),
      { params: Promise.resolve({ id: reportId }) },
    );
    expect(unauthorized.status).toBe(404);

    getAllLostItemsMock.mockReturnValue([]);
    const noMatch = await POST(
      new NextRequest(`http://localhost/api/lost-reports/${reportId}/resolve`, {
        method: "POST",
        headers: {
          cookie: `${reportOwnerCookieName(reportId)}=${ownerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ itemId }),
      }),
      { params: Promise.resolve({ id: reportId }) },
    );
    expect(noMatch.status).toBe(404);
    expect(resolveLostItemForReportMock).not.toHaveBeenCalled();
  });
});
