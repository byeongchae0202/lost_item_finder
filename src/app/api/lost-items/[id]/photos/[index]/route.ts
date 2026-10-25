import { readFile } from "node:fs/promises";
import path from "node:path";
import { getLostItem } from "@/lib/lost-items/database";
import { getLostItemUploadDirectory } from "@/lib/lost-items/data-paths";

const photoPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\.(jpg|png|webp)$/i;
const contentTypes = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index: indexValue } = await params;
  const index = Number(indexValue);
  if (!Number.isSafeInteger(index) || index < 0) {
    return new Response(null, { status: 404 });
  }

  const item = getLostItem(id);
  const filename = item?.photoPaths[index];
  if (!filename || !photoPattern.test(filename)) {
    return new Response(null, { status: 404 });
  }

  try {
    const bytes = await readFile(path.join(/*turbopackIgnore: true*/ getLostItemUploadDirectory(), filename));
    const extension = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase() as keyof typeof contentTypes;
    return new Response(bytes, {
      headers: {
        "Content-Type": contentTypes[extension],
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}