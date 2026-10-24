// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteStoredPhotoFiles, storePhotoFiles, validatePhotoFiles } from "@/lib/lost-items/photos";

const { getLostItemMock } = vi.hoisted(() => ({
  getLostItemMock: vi.fn(),
}));

vi.mock("@/lib/lost-items/database", () => ({
  getLostItem: getLostItemMock,
}));

import { GET } from "./route";

const itemId = "123e4567-e89b-12d3-a456-426614174000";
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=",
  "base64",
);
let storedFilenames: string[] = [];

afterEach(async () => {
  getLostItemMock.mockReset();
  await deleteStoredPhotoFiles(storedFilenames);
  storedFilenames = [];
});

describe("lost item photo route", () => {
  it("returns an attached photo with a safe content type", async () => {
    const [photo] = await validatePhotoFiles([
      new File([pngBytes], "photo.png", { type: "image/png" }),
    ]);
    storedFilenames = await storePhotoFiles([photo]);
    getLostItemMock.mockReturnValue({ photoPaths: storedFilenames });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: itemId, index: "0" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(pngBytes));
  });

  it("does not serve paths that are not attached to the item", async () => {
    getLostItemMock.mockReturnValue({ photoPaths: ["../../.env"] });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: itemId, index: "0" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 for an invalid photo index", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: itemId, index: "-1" }),
    });

    expect(response.status).toBe(404);
    expect(getLostItemMock).not.toHaveBeenCalled();
  });
});
