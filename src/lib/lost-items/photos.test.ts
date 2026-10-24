import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  deleteStoredPhotoFiles,
  MAX_PHOTO_COUNT,
  MAX_PHOTO_SIZE_BYTES,
  storePhotoFiles,
  validatePhotoFiles,
} from "./photos";

const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=",
  "base64",
);
const supportedImageSamples = [
  {
    label: "JPG",
    bytes: new Uint8Array(Buffer.from("ffd8ffe000104a4649460001", "hex")),
    extension: "jpg",
    mimeType: "image/jpeg",
  },
  {
    label: "PNG",
    bytes: new Uint8Array(pngBytes),
    extension: "png",
    mimeType: "image/png",
  },
  {
    label: "WEBP",
    bytes: new Uint8Array(Buffer.from("52494646260000005745425056503820", "hex")),
    extension: "webp",
    mimeType: "image/webp",
  },
];

function createFile(bytes: Uint8Array, name = "upload.bin", type = "application/octet-stream") {
  const blobBytes = new Uint8Array(bytes.byteLength);
  blobBytes.set(bytes);
  return new File([blobBytes.buffer], name, { type });
}

describe("photo upload validation", () => {
  it("uses the detected PNG signature instead of the supplied filename and MIME type", async () => {
    const [photo] = await validatePhotoFiles([createFile(pngBytes)]);

    expect(photo.mimeType).toBe("image/png");
    expect(photo.extension).toBe("png");
    expect(photo.bytes).toEqual(new Uint8Array(pngBytes));
  });

  it.each(supportedImageSamples)("accepts $label by its content signature", async (sample) => {
    const [photo] = await validatePhotoFiles([createFile(sample.bytes)]);

    expect(photo.extension).toBe(sample.extension);
    expect(photo.mimeType).toBe(sample.mimeType);
  });

  it("rejects content that is not a supported image", async () => {
    await expect(validatePhotoFiles([createFile(Buffer.from("not an image"))])).rejects.toThrow(
      "Photos must be JPG, PNG, or WEBP images.",
    );
  });

  it("rejects empty files", async () => {
    await expect(validatePhotoFiles([createFile(new Uint8Array())])).rejects.toThrow(
      "Photo files cannot be empty.",
    );
  });

  it("enforces the 5 MB per-file limit", async () => {
    const bytes = new Uint8Array(MAX_PHOTO_SIZE_BYTES + 1);
    bytes.set(pngBytes);

    await expect(validatePhotoFiles([createFile(bytes)])).rejects.toThrow(
      "Each photo must be 5 MB or smaller.",
    );
  });

  it("accepts a file exactly at the 5 MB limit", async () => {
    const bytes = new Uint8Array(MAX_PHOTO_SIZE_BYTES);
    bytes.set(pngBytes);

    await expect(validatePhotoFiles([createFile(bytes)])).resolves.toHaveLength(1);
  });

  it("allows at most three photos", async () => {
    const files = Array.from({ length: MAX_PHOTO_COUNT + 1 }, () => createFile(pngBytes));

    await expect(validatePhotoFiles(files)).rejects.toThrow(
      "A maximum of 3 photos is allowed.",
    );
  });

  it("accepts exactly three photos", async () => {
    const files = Array.from({ length: MAX_PHOTO_COUNT }, () => createFile(pngBytes));

    await expect(validatePhotoFiles(files)).resolves.toHaveLength(MAX_PHOTO_COUNT);
  });

  it("stores photos under generated names and removes them when requested", async () => {
    const photos = await validatePhotoFiles([createFile(pngBytes)]);
    const filenames = await storePhotoFiles(photos);
    const storedPath = path.join(process.cwd(), "data", "uploads", filenames[0]);

    try {
      expect(filenames[0]).toMatch(/^[\da-f-]{36}\.png$/i);
      expect(await readFile(storedPath)).toEqual(pngBytes);
    } finally {
      await deleteStoredPhotoFiles(filenames);
    }
  });
});
