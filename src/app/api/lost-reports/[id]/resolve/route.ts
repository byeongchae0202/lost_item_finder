import { NextRequest, NextResponse } from "next/server";
import {
  getAllLostItems,
  getLostReport,
  getLostItemsDatabase,
  resolveLostItemForReport,
} from "@/lib/lost-items/database";
import { deleteStoredPhotoFiles } from "@/lib/lost-items/photos";
import { findLostItemMatches } from "@/lib/lost-reports/matching";
import {
  reportOwnerCookieName,
  verifyReportOwnerToken,
} from "@/lib/lost-reports/ownership";

const reportIdPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const itemIdPattern = reportIdPattern;

function notFoundResponse() {
  return NextResponse.json(
    { error: "Lost report or matching item not found." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params;
  if (!reportIdPattern.test(reportId)) return notFoundResponse();

  const ownerToken = request.cookies.get(reportOwnerCookieName(reportId))?.value;
  const report = getLostReport(reportId);
  if (!report || !verifyReportOwnerToken(ownerToken, report.ownerTokenHash)) {
    return notFoundResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || typeof (body as { itemId?: unknown }).itemId !== "string") {
    return NextResponse.json({ error: "itemId is required." }, { status: 400 });
  }

  const itemId = (body as { itemId: string }).itemId;
  if (!itemIdPattern.test(itemId)) return notFoundResponse();

  const reportInput = {
    title: report.title,
    category: report.category,
    location: report.location,
    lostDate: report.lostDate,
    ...(report.description ? { description: report.description } : {}),
  };
  const matches = findLostItemMatches(reportInput, getAllLostItems());
  if (!matches.some((match) => match.itemId === itemId)) return notFoundResponse();

  const resolvedPhotoPaths = resolveLostItemForReport(
    getLostItemsDatabase(),
    itemId,
    reportId,
    report.ownerTokenHash,
  );
  if (!resolvedPhotoPaths) return notFoundResponse();

  try {
    await deleteStoredPhotoFiles(resolvedPhotoPaths);
  } catch {
    return NextResponse.json(
      { error: "The item was hidden, but its stored photos could not be cleaned up." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { resolved: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
