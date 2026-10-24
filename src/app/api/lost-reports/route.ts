import { NextResponse } from "next/server";
import { getAllLostItems } from "@/lib/lost-items/database";
import {
  deleteStoredPhotoFiles,
  storePhotoFiles,
  validatePhotoFiles,
} from "@/lib/lost-items/photos";
import { LostItemValidationError, parseCreateLostReportInput } from "@/lib/lost-items/validation";
import { createLostReport } from "@/lib/lost-items/database";
import { findLostItemMatches } from "@/lib/lost-reports/matching";
import {
  createReportOwnerToken,
  hashReportOwnerToken,
  reportOwnerCookieName,
} from "@/lib/lost-reports/ownership";

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
        lostDate: formData.get("lostDate"),
        description: formData.get("description") ?? "",
      };

      for (const value of formData.getAll("photos")) {
        if (typeof value === "string") {
          return Response.json({ error: "Photos must be uploaded as files." }, { status: 400 });
        }
        if (value.name !== "" || value.size > 0) photos.push(value);
      }
    } else {
      body = await request.json();
    }
  } catch {
    return Response.json({ error: "Request body is invalid." }, { status: 400 });
  }

  let storedPhotoPaths: string[] = [];
  try {
    const input = parseCreateLostReportInput(body);
    const validatedPhotos = await validatePhotoFiles(photos);
    storedPhotoPaths = await storePhotoFiles(validatedPhotos);

    const ownerToken = createReportOwnerToken();
    const report = createLostReport(input, hashReportOwnerToken(ownerToken), storedPhotoPaths);
    const matches = findLostItemMatches(input, getAllLostItems());
    const response = NextResponse.json(
      { reportId: report.id, matches },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );

    response.cookies.set({
      name: reportOwnerCookieName(report.id),
      value: ownerToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: `/api/lost-reports/${report.id}`,
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

    return Response.json({ error: "Unable to save the lost report." }, { status: 500 });
  }
}