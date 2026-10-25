// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashReportOwnerToken, lostItemOwnerCookieName } from "@/lib/lost-reports/ownership";

const {
  createLostItemMock,
  getAllLostItemsMock,
  getLostItemOwnerTokenHashMock,
  validatePhotoFilesMock,
  storePhotoFilesMock,
  deleteStoredPhotoFilesMock,
} = vi.hoisted(() => ({
  createLostItemMock: vi.fn(),
  getAllLostItemsMock: vi.fn(),
  getLostItemOwnerTokenHashMock: vi.fn(),
  validatePhotoFilesMock: vi.fn(),
  storePhotoFilesMock: vi.fn(),
  deleteStoredPhotoFilesMock: vi.fn(),
}));

vi.mock("@/lib/lost-items/database", () => ({
  createLostItem: createLostItemMock,
  getAllLostItems: getAllLostItemsMock,
  getLostItemOwnerTokenHash: getLostItemOwnerTokenHashMock,
}));

vi.mock("@/lib/lost-items/photos", () => ({
  validatePhotoFiles: validatePhotoFilesMock,
  storePhotoFiles: storePhotoFilesMock,
  deleteStoredPhotoFiles: deleteStoredPhotoFilesMock,
}));

import { GET, POST } from "./route";

const validInput = {
  title: "검은색 지갑",
  category: "지갑/카드",
  location: "중앙 도서관",
  description: "학생증이 들어 있습니다.",
  foundDate: "2000-01-01",
};

beforeEach(() => {
  getLostItemOwnerTokenHashMock.mockReturnValue(null);
  validatePhotoFilesMock.mockResolvedValue([]);
  storePhotoFilesMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("lost items route", () => {
  it("returns all saved items", async () => {
    getAllLostItemsMock.mockReturnValue([{ id: "item-1", ...validInput }]);

    const response = GET(new NextRequest("http://localhost/api/lost-items"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toHaveLength(1);
  });

  it("marks an item as owned only when its cookie hash matches", async () => {
    const token = "a".repeat(43);
    getAllLostItemsMock.mockReturnValue([{ id: "item-1", ...validInput }]);
    getLostItemOwnerTokenHashMock.mockReturnValue(hashReportOwnerToken(token));

    const response = GET(
      new NextRequest("http://localhost/api/lost-items", {
        headers: { cookie: `${lostItemOwnerCookieName("item-1")}=${token}` },
      }),
    );

    await expect(response.json()).resolves.toMatchObject([{ id: "item-1", isOwner: true }]);
  });

  it("rejects an unsupported category filter", async () => {
    const response = GET(
      new NextRequest("http://localhost/api/lost-items?category=음식"),
    );

    expect(response.status).toBe(400);
    expect(getAllLostItemsMock).not.toHaveBeenCalled();
  });

  it("creates a valid item and returns 201", async () => {
    createLostItemMock.mockReturnValue({ id: "item-1", ...validInput });
    const request = new Request("http://localhost/api/lost-items", {
      method: "POST",
      body: JSON.stringify(validInput),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(createLostItemMock).toHaveBeenCalledWith(
      { ...validInput, custodyStatus: "held_by_finder" },
      [],
      expect.stringMatching(/^[a-f\d]{64}$/),
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Path=/api/lost-items");
    await expect(response.json()).resolves.toMatchObject({ id: "item-1" });
  });

  it("stores uploaded photos and associates their paths with the item", async () => {
    const formData = new FormData();
    for (const [field, value] of Object.entries(validInput)) {
      formData.set(field, value);
    }
    formData.append("photos", new File(["image"], "photo.png", { type: "image/png" }));
    const validatedPhoto = {
      bytes: new Uint8Array([1]),
      extension: "png",
      mimeType: "image/png",
    };
    validatePhotoFilesMock.mockResolvedValue([validatedPhoto]);
    storePhotoFilesMock.mockResolvedValue(["generated.png"]);
    createLostItemMock.mockReturnValue({
      id: "item-1",
      ...validInput,
      photoPaths: ["generated.png"],
    });

    const response = await POST(
      new Request("http://localhost/api/lost-items", { method: "POST", body: formData }),
    );

    expect(response.status).toBe(201);
    expect(validatePhotoFilesMock).toHaveBeenCalledWith([expect.any(File)]);
    expect(createLostItemMock).toHaveBeenCalledWith(
      { ...validInput, custodyStatus: "held_by_finder" },
      ["generated.png"],
      expect.stringMatching(/^[a-f\d]{64}$/),
    );
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new Request("http://localhost/api/lost-items", {
      method: "POST",
      body: "{",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(createLostItemMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a future found date", async () => {
    const request = new Request("http://localhost/api/lost-items", {
      method: "POST",
      body: JSON.stringify({ ...validInput, foundDate: "2999-01-01" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(createLostItemMock).not.toHaveBeenCalled();
  });

  it("returns 500 without exposing persistence details", async () => {
    createLostItemMock.mockImplementation(() => {
      throw new Error("private database path");
    });
    const request = new Request("http://localhost/api/lost-items", {
      method: "POST",
      body: JSON.stringify(validInput),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to save the lost item.",
    });
  });
});
