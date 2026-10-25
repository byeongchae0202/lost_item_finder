// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashReportOwnerToken, lostItemOwnerCookieName } from "@/lib/lost-reports/ownership";

const { getLostItemOwnerTokenHashMock, getLostItemMock, getLostItemDetailsByIdMock, getLostItemsDatabaseMock, deleteOwnedLostItemMock, updateOwnedLostItemCustodyStatusMock, deleteStoredPhotoFilesMock } = vi.hoisted(() => ({
  getLostItemOwnerTokenHashMock: vi.fn(),
  getLostItemMock: vi.fn(),
  getLostItemDetailsByIdMock: vi.fn(),
  getLostItemsDatabaseMock: vi.fn(() => ({})),
  deleteOwnedLostItemMock: vi.fn(),
  updateOwnedLostItemCustodyStatusMock: vi.fn(),
  deleteStoredPhotoFilesMock: vi.fn(),
}));

vi.mock("@/lib/lost-items/database", () => ({
  getLostItemOwnerTokenHash: getLostItemOwnerTokenHashMock,
  getLostItem: getLostItemMock,
  getLostItemDetailsById: getLostItemDetailsByIdMock,
  getLostItemsDatabase: getLostItemsDatabaseMock,
  deleteOwnedLostItem: deleteOwnedLostItemMock,
  updateOwnedLostItemCustodyStatus: updateOwnedLostItemCustodyStatusMock,
}));
vi.mock("@/lib/lost-items/photos", () => ({
  deleteStoredPhotoFiles: deleteStoredPhotoFilesMock,
}));

import { DELETE, GET, PATCH } from "./route";

const itemId = "123e4567-e89b-12d3-a456-426614174000";
const ownerToken = "a".repeat(43);
const item = {
  id: itemId,
  title: "검은색 지갑",
  category: "지갑/카드",
  location: "중앙 도서관",
  description: "파란 키링",
  foundDate: "2000-01-01",
  custodyStatus: "held_by_finder",
  photoPaths: [],
  createdAt: "2000-01-01T00:00:00.000Z",
};

afterEach(() => vi.resetAllMocks());

describe("owned lost item deletion route", () => {
  it("deletes an item and its photos for the poster", async () => {
    getLostItemOwnerTokenHashMock.mockReturnValue(hashReportOwnerToken(ownerToken));
    deleteOwnedLostItemMock.mockReturnValue(["photo.png"]);

    const response = await DELETE(
      new NextRequest(`http://localhost/api/lost-items/${itemId}`, {
        method: "DELETE",
        headers: { cookie: `${lostItemOwnerCookieName(itemId)}=${ownerToken}` },
      }),
      { params: Promise.resolve({ id: itemId }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(deleteOwnedLostItemMock).toHaveBeenCalledWith(expect.anything(), itemId, hashReportOwnerToken(ownerToken));
    expect(deleteStoredPhotoFilesMock).toHaveBeenCalledWith(["photo.png"]);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("does not delete another person's item", async () => {
    getLostItemOwnerTokenHashMock.mockReturnValue(hashReportOwnerToken("b".repeat(43)));

    const response = await DELETE(
      new NextRequest(`http://localhost/api/lost-items/${itemId}`, {
        method: "DELETE",
        headers: { cookie: `${lostItemOwnerCookieName(itemId)}=${ownerToken}` },
      }),
      { params: Promise.resolve({ id: itemId }) },
    );

    expect(response.status).toBe(404);
    expect(deleteOwnedLostItemMock).not.toHaveBeenCalled();
    expect(deleteStoredPhotoFilesMock).not.toHaveBeenCalled();
  });

  it("shows current custody status publicly and marks whether the viewer owns it", async () => {
    getLostItemDetailsByIdMock.mockReturnValue(item);
    getLostItemOwnerTokenHashMock.mockReturnValue(hashReportOwnerToken(ownerToken));

    const response = await GET(
      new NextRequest(`http://localhost/api/lost-items/${itemId}`, {
        headers: { cookie: `${lostItemOwnerCookieName(itemId)}=${ownerToken}` },
      }),
      { params: Promise.resolve({ id: itemId }) },
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.custodyStatus).toBe("held_by_finder");
    expect(result.isOwner).toBe(true);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each(["held_by_finder", "department_office", "student_union_office", "other", "returned"])(
    "lets only the poster persist the %s custody status",
    async (custodyStatus) => {
    getLostItemOwnerTokenHashMock.mockReturnValue(hashReportOwnerToken(ownerToken));
    getLostItemMock.mockReturnValue(item);
    updateOwnedLostItemCustodyStatusMock.mockReturnValue(true);

    const response = await PATCH(
      new NextRequest(`http://localhost/api/lost-items/${itemId}`, {
        method: "PATCH",
        headers: {
          cookie: `${lostItemOwnerCookieName(itemId)}=${ownerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ custodyStatus, ...(custodyStatus === "other" ? { custodyNote: "안내데스크" } : {}) }),
      }),
      { params: Promise.resolve({ id: itemId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: itemId,
      custodyStatus,
      ...(custodyStatus === "other" ? { custodyNote: "안내데스크" } : {}),
    });
    expect(updateOwnedLostItemCustodyStatusMock).toHaveBeenCalledWith(
      expect.anything(),
      itemId,
      hashReportOwnerToken(ownerToken),
      custodyStatus,
      custodyStatus === "other" ? "안내데스크" : "",
    );
  });

  it("rejects unsupported states and non-owner status changes", async () => {
    getLostItemOwnerTokenHashMock.mockReturnValue(hashReportOwnerToken(ownerToken));
    const unsupported = await PATCH(
      new NextRequest(`http://localhost/api/lost-items/${itemId}`, {
        method: "PATCH",
        headers: {
          cookie: `${lostItemOwnerCookieName(itemId)}=${ownerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ custodyStatus: "lost" }),
      }),
      { params: Promise.resolve({ id: itemId }) },
    );
    expect(unsupported.status).toBe(400);

    const nonOwner = await PATCH(
      new NextRequest(`http://localhost/api/lost-items/${itemId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ custodyStatus: "student_union_office" }),
      }),
      { params: Promise.resolve({ id: itemId }) },
    );
    expect(nonOwner.status).toBe(404);
    expect(updateOwnedLostItemCustodyStatusMock).not.toHaveBeenCalled();
  });
});
