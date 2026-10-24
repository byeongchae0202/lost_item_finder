import { describe, expect, it } from "vitest";
import { isItemCategory, ITEM_CATEGORIES } from "./categories";

describe("lost item categories", () => {
  it("defines the six agreed categories and examples", () => {
    expect(ITEM_CATEGORIES.map((category) => category.label)).toEqual([
      "전자기기",
      "지갑/카드",
      "학용품/도서",
      "의류/잡화",
      "열쇠/기타",
      "기타 물품",
    ]);
    expect(ITEM_CATEGORIES.every((category) => category.examples.length > 0)).toBe(true);
  });

  it("accepts only configured categories", () => {
    expect(isItemCategory("전자기기")).toBe(true);
    expect(isItemCategory("음식")).toBe(false);
  });
});