import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { LostItemValidationError } from "./validation";

export const MAX_PHOTO_COUNT = 3;
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

const allowedImageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ValidatedPhoto = {
  bytes: Uint8Array;
  extension: (typeof allowedImageTypes)[keyof typeof allowedImageTypes];
  mimeType: keyof typeof allowedImageTypes;
};

export async function validatePhotoFiles(files: File[]): Promise<ValidatedPhoto[]> {
  if (files.length > MAX_PHOTO_COUNT) {
    throw new LostItemValidationError(`A maximum of ${MAX_PHOTO_COUNT} photos is allowed.`);
  }

  const photos: ValidatedPhoto[] = [];
  for (const file of files) {
    if (file.size === 0) {
      throw new LostItemValidationError("Photo files cannot be empty.");
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      throw new LostItemValidationError("Each photo must be 5 MB or smaller.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detectedType = await fileTypeFromBuffer(bytes);
    if (!detectedType || !(detectedType.mime in allowedImageTypes)) {
      throw new LostItemValidationError("Photos must be JPG, PNG, or WEBP images.");
    }

    const mimeType = detectedType.mime as keyof typeof allowedImageTypes;
    photos.push({
      bytes,
      mimeType,
      extension: allowedImageTypes[mimeType],
    });
  }

  return photos;
}

export async function storePhotoFiles(photos: ValidatedPhoto[]): Promise<string[]> {
  const uploadDirectory = path.join(process.cwd(), "data", "uploads");
  await mkdir(uploadDirectory, { recursive: true });

  const storedNames: string[] = [];
  try {
    for (const photo of photos) {
      const filename = `${randomUUID()}.${photo.extension}`;
      await writeFile(path.join(uploadDirectory, filename), photo.bytes, { flag: "wx" });
      storedNames.push(filename);
    }
    return storedNames;
  } catch (error) {
    await deleteStoredPhotoFiles(storedNames);
    throw error;
  }
}

export async function deleteStoredPhotoFiles(filenames: string[]): Promise<void> {
  await Promise.all(
    filenames.map(async (filename) => {
      try {
        await unlink(path.join(process.cwd(), "data", "uploads", filename));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }),
  );
}