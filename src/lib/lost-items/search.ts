import type { ItemCategory } from "./categories";
import type { LostItemRecord } from "./database";

export type LostItemSearchFilters = {
  location?: string;
  category?: ItemCategory;
  keyword?: string;
};

const bilingualSearchAliases = [
  ["아이패드", "ipad", "tablet"],
  ["에어", "air"],
  ["아이폰", "iphone"],
  ["에어팟", "airpods", "airpod"],
  ["갤럭시", "galaxy"],
  ["버즈", "buds", "galaxy buds"],
  ["맥북", "macbook"],
  ["애플펜슬", "apple pencil", "applepencil"],
  ["키보드", "keyboard"],
  ["마우스", "mouse"],
  ["충전기", "charger", "charging adapter"],
  ["이어폰", "earphones", "earphone", "earbuds", "earbud"],
  ["헤드폰", "headphones", "headphone", "headset"],
  ["지갑", "wallet"],
  ["학생증", "student id", "student card"],
  ["신분증", "id card", "identity card"],
  ["우산", "umbrella"],
  ["물병", "water bottle", "bottle"],
  ["텀블러", "tumbler"],
  ["가방", "bag", "backpack"],
  ["열쇠", "key", "keys"],
  ["책", "book", "textbook"],
  ["필통", "pencil case", "pencilcase"],
  ["계산기", "calculator"],
  ["시계", "watch"],
  ["안경", "glasses", "eyeglasses"],
  ["모자", "hat", "cap"],
  ["후드티", "hoodie"],
  ["패딩", "puffer jacket"],
  ["무선", "wireless"],
  ["프로", "pro"],
] as const;

export function normalizeSearchText(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("ko-KR");
}

function containsAlias(text: string, alias: string): boolean {
  if (/^[a-z\d ]+$/u.test(alias)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/\s+/gu, "\\s+");
    return new RegExp(`(^|[^a-z\\d])${escaped}(?=$|[^a-z\\d])`, "u").test(text);
  }
  return text.includes(alias);
}

function expandBilingualSearchText(value: string): string {
  const normalized = normalizeSearchText(value);
  const aliases = new Set([normalized]);

  for (const group of bilingualSearchAliases) {
    if (group.some((alias) => containsAlias(normalized, alias))) {
      for (const alias of group) aliases.add(alias);
    }
  }

  return normalizeSearchText([...aliases].join(" "));
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

    const searchableFields = [item.title, item.description, item.location].map(expandBilingualSearchText);
    return terms.every((term) =>
      searchableFields.some((field) => field.includes(term)),
    );
  });
}