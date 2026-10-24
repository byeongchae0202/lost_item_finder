import {
  createLostItem,
  getAllLostItems,
} from "@/lib/lost-items/database";
import {
  LostItemValidationError,
  parseCreateLostItemInput,
} from "@/lib/lost-items/validation";
import {
  deleteStoredPhotoFiles,
  storePhotoFiles,
  validatePhotoFiles,
} from "@/lib/lost-items/photos";
import { isItemCategory, type ItemCategory } from "@/lib/lost-items/categories";
import { searchLostItems } from "@/lib/lost-items/search";

export function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const categoryValue = searchParams.get("category")?.trim() ?? "";
  if (categoryValue && !isItemCategory(categoryValue)) {
    return Response.json({ error: "category is not supported." }, { status: 400 });
  }

  return Response.json(
    searchLostItems(getAllLostItems(), {
      location: searchParams.get("location") ?? undefined,
      category: categoryValue ? (categoryValue as ItemCategory) : undefined,
      keyword: searchParams.get("keyword") ?? undefined,
    }),
  );
}

export async function POST(request: Request) {
  let body: unknown;
  const photos: File[] = [];

  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await request.formData();
      body = {
        title: formData.get("title"),
        category: formData.get("category"),
        location: formData.get("location"),
        description: formData.get("description"),
        foundDate: formData.get("foundDate"),
      };

      for (const value of formData.getAll("photos")) {
        if (typeof value === "string") {
          return Response.json({ error: "Photos must be uploaded as files." }, { status: 400 });
        }
        if (value.name !== "" || value.size > 0) {
          photos.push(value);
        }
      }
    } else {
      body = await request.json();
    }
  } catch {
    return Response.json({ error: "Request body is invalid." }, { status: 400 });
  }

  let storedPhotoPaths: string[] = [];
  try {
    const input = parseCreateLostItemInput(body);
    const validatedPhotos = await validatePhotoFiles(photos);
    storedPhotoPaths = await storePhotoFiles(validatedPhotos);
    return Response.json(createLostItem(input, storedPhotoPaths), { status: 201 });
  } catch (error) {
    if (storedPhotoPaths.length > 0) {
      await deleteStoredPhotoFiles(storedPhotoPaths);
    }
    if (error instanceof LostItemValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ error: "Unable to save the lost item." }, { status: 500 });
  }
}