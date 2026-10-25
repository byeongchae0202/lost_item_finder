import path from "node:path";

export function getLostItemDataDirectory(): string {
  return path.resolve(
    /*turbopackIgnore: true*/ process.env.LOST_ITEM_DATA_DIR || path.join(process.cwd(), "data"),
  );
}

export function getLostItemUploadDirectory(): string {
  return path.join(getLostItemDataDirectory(), "uploads");
}