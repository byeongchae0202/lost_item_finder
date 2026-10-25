import { describe, expect, it } from "vitest";
import { searchLostItems } from "./search";
import type { LostItemRecord } from "./database";

const items: LostItemRecord[] = [
  {
    id: "keyboard",
    title: "무선 키보드",
    category: "전자기기",
    location: "제1공학관\t세미나실",
    description: "검은색 라이언 키링 부착",
    foundDate: "2026-10-20",
    photoPaths: [],
    createdAt: "2026-10-20T10:00:00.000Z",
  },
  {
    id: "wallet",
    title: "검은색 지갑",
    category: "지갑/카드",
    location: "도서관 로비",
    description: "학생증 포함",
    foundDate: "2026-10-21",
    photoPaths: [],
    createdAt: "2026-10-21T10:00:00.000Z",
  },
];

describe("searchLostItems", () => {
  it("matches partial locations after whitespace and case normalization", () => {
    expect(searchLostItems(items, { location: "  공학관   세미나실 " })).toEqual([
      items[0],
    ]);
  });

  it("applies a category filter", () => {
    expect(searchLostItems(items, { category: "지갑/카드" })).toEqual([items[1]]);
  });

  it("matches English item names when the query is Korean and vice versa", () => {
    const englishListing = {
      ...items[0],
      title: "iPad Air",
      description: "Apple Pencil and blue case",
    };
    const koreanListing = {
      ...items[1],
      title: "에어팟 프로",
      description: "검정색 케이스",
    };

    expect(searchLostItems([englishListing], { keyword: "아이패드 에어" })).toEqual([englishListing]);
    expect(searchLostItems([koreanListing], { keyword: "airpods pro" })).toEqual([koreanListing]);
    expect(searchLostItems([englishListing], { keyword: "애플펜슬" })).toEqual([englishListing]);
  });

  it("requires every keyword while matching each across title, description, or location", () => {
    expect(searchLostItems(items, { keyword: "키보드 제1공학관" })).toEqual([
      items[0],
    ]);
    expect(searchLostItems(items, { keyword: "키보드 지갑" })).toEqual([]);
  });

  it("combines location, category, and keyword filters with AND", () => {
    expect(
      searchLostItems(items, {
        location: "공학관",
        category: "전자기기",
        keyword: "검은색 키링",
      }),
    ).toEqual([items[0]]);
    expect(
      searchLostItems(items, {
        location: "공학관",
        category: "지갑/카드",
      }),
    ).toEqual([]);
  });

  it("ignores blank search values", () => {
    expect(searchLostItems(items, { location: "   ", keyword: "  " })).toEqual(items);
  });
});