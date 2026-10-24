// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashReportOwnerToken, lostItemOwnerCookieName } from "@/lib/lost-reports/ownership";

const { getLostItemOwnerTokenHashMock, getLostItemsDatabaseMock, deleteOwnedLostItemMock, deleteStoredPhotoFilesMock } = vi.hoisted(() => ({
  getLostItemOwnerTokenHashMock: vi.fn(),
  getLostItemsDatabaseMock: vi.fn(() => ({})),
  deleteOwnedLostItemMock: vi.fn(),
  deleteStoredPhotoFilesMock: vi.fn(),
}));

vi.mock("@/lib/lost-items/database", () => ({
  getLostItemOwnerTokenHash: getLostItemOwnerTokenHashMock,
  getLostItemsDatabase: getLostItemsDatabaseMock,
  deleteOwnedLostItem: deleteOwnedLostItemMock,
}));
vi.mock("@/lib/lost-items/photos", () => ({
  deleteStoredPhotoFiles: deleteStoredPhotoFilesMock,
}));

import { DELETE } from "./route";

const itemId = "123e4567-e89b-12d3-a456-426614174000";
const ownerToken = "a".repeat(43);

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
});
