import { describe, expect, it } from "vitest";
import type { LostItemRecord } from "@/lib/lost-items/database";
import { findLostItemMatches } from "./matching";

const report = {
  title: "검은색 아이패드",
  category: "전자기기" as const,
  location: "공학관",
  lostDate: "2026-10-01",
  description: "파란 케이스",
};

function foundItem(overrides: Partial<LostItemRecord> = {}): LostItemRecord {
  return {
    id: "found-1",
    title: "아이패드",
    category: "전자기기",
    location: "제1공학관 로비",
    description: "검은색 파란 케이스",
    foundDate: "2026-10-01",
    photoPaths: ["image.png"],
    custodyStatus: "held_by_finder",
    createdAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("findLostItemMatches", () => {
  it("requires category equality and a found date within the inclusive 30-day window", () => {
    const matches = findLostItemMatches(report, [
      foundItem({ id: "wrong-category", category: "기타 물품" }),
      foundItem({ id: "before", foundDate: "2026-09-30" }),
      foundItem({ id: "day-30", foundDate: "2026-10-31" }),
      foundItem({ id: "day-31", foundDate: "2026-11-01" }),
    ]);

    expect(matches.map((match) => match.itemId)).toEqual(["day-30"]);
  });

  it("adds location, date, and up to six distinct keyword bonuses", () => {
    const match = findLostItemMatches(
      { ...report, title: "아이패드 케이스 파랑 검정" },
      [foundItem({ title: "아이패드 케이스 파랑 검정 분실물", foundDate: "2026-10-03" })],
    )[0];

    expect(match.score).toBe(28 + 20 + 25);
    expect(match.dayDifference).toBe(2);
    expect(match.reasons).toEqual([
      "날짜 근접 +28",
      "장소 유사 +20",
      "공통 키워드 5개 +25",
    ]);
  });

  it("matches location or shared keywords and returns candidate display details", () => {
    const locationOnly = foundItem({
      id: "location-only",
      title: "태블릿",
      location: "공학관 2층",
      description: "케이스 포함",
    });
    const keywordOnly = foundItem({
      id: "keyword-only",
      title: "검은색 아이패드",
      location: "학생회관",
      description: "",
      photoPaths: [],
    });

    const matches = findLostItemMatches(report, [locationOnly, keywordOnly]);
    const itemWithPhoto = matches.find((match) => match.itemId === locationOnly.id);
    const itemWithoutPhoto = matches.find((match) => match.itemId === keywordOnly.id);

    expect(itemWithPhoto?.thumbnailUrl).toBe("/api/lost-items/location-only/photos/0");
    expect(itemWithoutPhoto?.thumbnailUrl).toBeNull();
    expect(matches.every((match) => match.reasons.length > 0)).toBe(true);
  });

  it("sorts by score and caps the result at ten", () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      foundItem({
        id: `found-${index}`,
        title: `아이패드 ${index}`,
        location: "공학관",
        description: "",
        foundDate: `2026-10-${String(index + 1).padStart(2, "0")}`,
        photoPaths: [],
      }),
    );
    const matches = findLostItemMatches(report, items);

    expect(matches).toHaveLength(10);
    expect(matches[0].score).toBeGreaterThanOrEqual(matches.at(-1)?.score ?? 0);
  });

  it("returns no candidates when neither location nor keywords match", () => {
    expect(
      findLostItemMatches(report, [
        foundItem({ title: "태블릿", location: "학생회관", description: "회색 커버" }),
      ]),
    ).toEqual([]);
  });
});