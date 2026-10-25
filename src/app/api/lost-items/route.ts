import {
  createLostItem,
  getAllLostItems,
  getLostItemOwnerTokenHash,
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
import { NextRequest, NextResponse } from "next/server";
import {
  createReportOwnerToken,
  hashReportOwnerToken,
  lostItemOwnerCookieName,
  verifyReportOwnerToken,
} from "@/lib/lost-reports/ownership";

export function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  const categoryValue = searchParams.get("category")?.trim() ?? "";
  if (categoryValue && !isItemCategory(categoryValue)) {
    return Response.json({ error: "category is not supported." }, { status: 400 });
  }

  const items = searchLostItems(getAllLostItems(), {
      location: searchParams.get("location") ?? undefined,
      category: categoryValue ? (categoryValue as ItemCategory) : undefined,
      keyword: searchParams.get("keyword") ?? undefined,
    });

  return NextResponse.json(
    items.map((item) => ({
      ...item,
      isOwner: verifyReportOwnerToken(
        request.cookies.get(lostItemOwnerCookieName(item.id))?.value,
        getLostItemOwnerTokenHash(item.id) ?? "",
      ),
    })),
    { headers: { "Cache-Control": "no-store", Vary: "Cookie" } },
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
        ...(typeof formData.get("custodyStatus") === "string"
          ? { custodyStatus: formData.get("custodyStatus") }
          : {}),
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
    const ownerToken = createReportOwnerToken();
    const item = createLostItem(input, storedPhotoPaths, hashReportOwnerToken(ownerToken));
    const response = NextResponse.json(item, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set({
      name: lostItemOwnerCookieName(item.id),
      value: ownerToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/lost-items",
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
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