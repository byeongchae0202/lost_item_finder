import { NextRequest, NextResponse } from "next/server";
import {
  deleteOwnedLostItem,
  getLostItem,
  getLostItemDetailsById,
  getLostItemOwnerTokenHash,
  getLostItemsDatabase,
  updateOwnedLostItemCustodyStatus,
} from "@/lib/lost-items/database";
import { deleteStoredPhotoFiles } from "@/lib/lost-items/photos";
import { isLostItemCustodyStatus } from "@/lib/lost-items/custody-status";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!itemIdPattern.test(id)) return notFoundResponse();

  const item = getLostItemDetailsById(getLostItemsDatabase(), id);
  if (!item) return notFoundResponse();
  const ownerToken = request.cookies.get(lostItemOwnerCookieName(id))?.value;
  const ownerTokenHash = getLostItemOwnerTokenHash(id) ?? "";

  return NextResponse.json(
    {
      ...item,
      photoPaths: item.custodyStatus === "returned" ? [] : item.photoPaths,
      isOwner: verifyReportOwnerToken(ownerToken, ownerTokenHash),
    },
    { headers: { "Cache-Control": "no-store", Vary: "Cookie" } },
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!itemIdPattern.test(id)) return notFoundResponse();

  const ownerToken = request.cookies.get(lostItemOwnerCookieName(id))?.value;
  const ownerTokenHash = getLostItemOwnerTokenHash(id);
  if (!verifyReportOwnerToken(ownerToken, ownerTokenHash ?? "")) return notFoundResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { custodyStatus?: unknown }).custodyStatus !== "string"
  ) {
    return NextResponse.json({ error: "custodyStatus is required." }, { status: 400 });
  }

  const custodyStatus = (body as { custodyStatus: string }).custodyStatus;
  const custodyNoteValue = (body as { custodyNote?: unknown }).custodyNote;
  if (!isLostItemCustodyStatus(custodyStatus)) {
    return NextResponse.json({ error: "custodyStatus is not supported." }, { status: 400 });
  }
  if (custodyNoteValue !== undefined && typeof custodyNoteValue !== "string") {
    return NextResponse.json({ error: "custodyNote must be text." }, { status: 400 });
  }
  const custodyNote = typeof custodyNoteValue === "string" ? custodyNoteValue.trim() : "";
  if (custodyStatus === "other" && custodyNote.length === 0) {
    return NextResponse.json({ error: "custodyNote is required for the other status." }, { status: 400 });
  }
  if (custodyNote.length > 80) {
    return NextResponse.json({ error: "custodyNote must be 80 characters or fewer." }, { status: 400 });
  }

  const item = getLostItem(id);
  if (!item || !ownerTokenHash) return notFoundResponse();
  const updated = updateOwnedLostItemCustodyStatus(
    getLostItemsDatabase(),
    id,
    ownerTokenHash,
    custodyStatus,
    custodyNote,
  );
  if (!updated) return notFoundResponse();

  if (custodyStatus === "returned" && item.photoPaths.length > 0) {
    try {
      await deleteStoredPhotoFiles(item.photoPaths);
    } catch {
      return NextResponse.json(
        { error: "Status was updated, but stored photos could not be cleaned up." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  return NextResponse.json(
    { id, custodyStatus, custodyNote: custodyStatus === "other" ? custodyNote : undefined },
    { headers: { "Cache-Control": "no-store" } },
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
