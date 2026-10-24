import type { ItemCategory } from "./categories";
import type { LostItemRecord } from "./database";

export type LostItemSearchFilters = {
  location?: string;
  category?: ItemCategory;
  keyword?: string;
};

export function normalizeSearchText(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("ko-KR");
}

export function searchLostItems(
  items: LostItemRecord[],
  filters: LostItemSearchFilters,
): LostItemRecord[] {
  const location = filters.location ? normalizeSearchText(filters.location) : "";
  const terms = filters.keyword
    ? normalizeSearchText(filters.keyword).split(" ").filter(Boolean)
    : [];

  return items.filter((item) => {
    if (filters.category && item.category !== filters.category) {
      return false;
    }

    const normalizedLocation = normalizeSearchText(item.location);
    if (location && !normalizedLocation.includes(location)) {
      return false;
    }

    const searchableFields = [item.title, item.description, item.location].map(
      normalizeSearchText,
    );
    return terms.every((term) =>
      searchableFields.some((field) => field.includes(term)),
    );
  });
}