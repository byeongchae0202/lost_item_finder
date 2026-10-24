// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashReportOwnerToken } from "@/lib/lost-reports/ownership";

const {
  createLostReportMock,
  getAllLostItemsMock,
  validatePhotoFilesMock,
  storePhotoFilesMock,
  deleteStoredPhotoFilesMock,
} = vi.hoisted(() => ({
  createLostReportMock: vi.fn(),
  getAllLostItemsMock: vi.fn(),
  validatePhotoFilesMock: vi.fn(),
  storePhotoFilesMock: vi.fn(),
  deleteStoredPhotoFilesMock: vi.fn(),
}));

vi.mock("@/lib/lost-items/database", () => ({
  createLostReport: createLostReportMock,
  getAllLostItems: getAllLostItemsMock,
}));

vi.mock("@/lib/lost-items/photos", () => ({
  deleteStoredPhotoFiles: deleteStoredPhotoFilesMock,
  storePhotoFiles: storePhotoFilesMock,
  validatePhotoFiles: validatePhotoFilesMock,
}));

import { POST } from "./route";

const validInput = {
  title: "검은색 지갑",
  category: "지갑/카드",
  location: "중앙 도서관",
  lostDate: "2000-01-01",
};

beforeEach(() => {
  createLostReportMock.mockReturnValue({ id: "report-1", ...validInput });
  getAllLostItemsMock.mockReturnValue([]);
  validatePhotoFilesMock.mockResolvedValue([]);
  storePhotoFilesMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("lost report creation route", () => {
  it("stores a private report and sets an HttpOnly owner cookie", async () => {
    const response = await POST(
      new Request("http://localhost/api/lost-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validInput),
      }),
    );
    const result = await response.json();
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(createLostReportMock).toHaveBeenCalledWith(
      { ...validInput },
      expect.stringMatching(/^[a-f\d]{64}$/),
      [],
    );
    expect(cookie).toContain("lost-report-owner-report-1=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie.toLowerCase()).toContain("samesite=strict");
    expect(cookie).toContain("Path=/api/lost-reports/report-1");
    expect(cookie).not.toContain(hashReportOwnerToken("not-the-owner-token"));
    expect(JSON.stringify(result)).not.toContain("ownerToken");
  });

  it("accepts multipart photos and returns matching candidates", async () => {
    const formData = new FormData();
    for (const [field, value] of Object.entries(validInput)) formData.set(field, value);
    formData.append("photos", new File(["image"], "lost.png", { type: "image/png" }));
    validatePhotoFilesMock.mockResolvedValue([
      { bytes: new Uint8Array([1]), extension: "png", mimeType: "image/png" },
    ]);
    storePhotoFilesMock.mockResolvedValue(["stored.png"]);
    getAllLostItemsMock.mockReturnValue([{ id: "found-1" }]);

    const response = await POST(
      new Request("http://localhost/api/lost-reports", { method: "POST", body: formData }),
    );
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(validatePhotoFilesMock).toHaveBeenCalledWith([expect.any(File)]);
    expect(createLostReportMock).toHaveBeenCalledWith(
      { ...validInput },
      expect.stringMatching(/^[a-f\d]{64}$/),
      ["stored.png"],
    );
    expect(result.matches).toEqual([]);
  });

  it("rejects missing fields, unsupported categories, and future dates", async () => {
    const invalidBodies = [
      { ...validInput, title: " " },
      { ...validInput, category: "음식" },
      { ...validInput, lostDate: "2999-01-01" },
    ];

    for (const body of invalidBodies) {
      const response = await POST(
        new Request("http://localhost/api/lost-reports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(createLostReportMock).not.toHaveBeenCalled();
  });

  it("removes uploaded photos when database persistence fails", async () => {
    const formData = new FormData();
    for (const [field, value] of Object.entries(validInput)) formData.set(field, value);
    formData.append("photos", new File(["image"], "lost.png", { type: "image/png" }));
    validatePhotoFilesMock.mockResolvedValue([
      { bytes: new Uint8Array([1]), extension: "png", mimeType: "image/png" },
    ]);
    storePhotoFilesMock.mockResolvedValue(["stored.png"]);
    createLostReportMock.mockImplementation(() => {
      throw new Error("database failure");
    });

    const response = await POST(
      new Request("http://localhost/api/lost-reports", { method: "POST", body: formData }),
    );

    expect(response.status).toBe(500);
    expect(deleteStoredPhotoFilesMock).toHaveBeenCalledWith(["stored.png"]);
  });
});