import { NextRequest, NextResponse } from "next/server";
import { getAllLostItems, getLostReport } from "@/lib/lost-items/database";
import { findLostItemMatches } from "@/lib/lost-reports/matching";
import {
  reportOwnerCookieName,
  verifyReportOwnerToken,
} from "@/lib/lost-reports/ownership";

const reportIdPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function notFoundResponse() {
  return NextResponse.json(
    { error: "Lost report not found." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!reportIdPattern.test(id)) return notFoundResponse();

  const report = getLostReport(id);
  if (!report) return notFoundResponse();

  const ownerToken = request.cookies.get(reportOwnerCookieName(id))?.value;
  if (!verifyReportOwnerToken(ownerToken, report.ownerTokenHash)) {
    return notFoundResponse();
  }

  const reportInput = {
    title: report.title,
    category: report.category,
    location: report.location,
    lostDate: report.lostDate,
    ...(report.description ? { description: report.description } : {}),
  };
  const matches = findLostItemMatches(reportInput, getAllLostItems());
  const response = NextResponse.json(
    {
      report: {
        id: report.id,
        title: report.title,
        category: report.category,
        location: report.location,
        lostDate: report.lostDate,
        description: report.description,
        photoCount: report.photoPaths.length,
      },
      matches,
    },
    { headers: { "Cache-Control": "no-store" } },
  );

  response.headers.set("Vary", "Cookie");
  return response;
}