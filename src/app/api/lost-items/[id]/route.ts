import { NextRequest, NextResponse } from "next/server";
import {
  deleteOwnedLostItem,
  getLostItemOwnerTokenHash,
  getLostItemsDatabase,
} from "@/lib/lost-items/database";
import { deleteStoredPhotoFiles } from "@/lib/lost-items/photos";
import {
  lostItemOwnerCookieName,
  verifyReportOwnerToken,
} from "@/lib/lost-reports/ownership";

const itemIdPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function notFoundResponse() {
  return NextResponse.json(
    { error: "Lost item not found." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!itemIdPattern.test(id)) return notFoundResponse();

  const ownerToken = request.cookies.get(lostItemOwnerCookieName(id))?.value;
  const ownerTokenHash = getLostItemOwnerTokenHash(id);
  if (!verifyReportOwnerToken(ownerToken, ownerTokenHash ?? "")) {
    return notFoundResponse();
  }

  const photoPaths = deleteOwnedLostItem(getLostItemsDatabase(), id, ownerTokenHash!);
  if (!photoPaths) return notFoundResponse();

  try {
    await deleteStoredPhotoFiles(photoPaths);
  } catch {
    return NextResponse.json(
      { error: "The item was removed, but its stored photos could not be cleaned up." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.json(
    { deleted: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set({
    name: lostItemOwnerCookieName(id),
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/lost-items",
    maxAge: 0,
  });
  return response;
}
