import { normalizeSearchText } from "@/lib/lost-items/search";
import type { LostItemRecord } from "@/lib/lost-items/database";
import type { CreateLostReportInput } from "@/lib/lost-items/validation";

const MATCH_WINDOW_DAYS = 30;
const LOCATION_BONUS = 20;
const KEYWORD_BONUS = 5;
const MAX_KEYWORD_BONUS = 30;
const MAX_MATCHES = 10;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type LostItemMatch = {
  itemId: string;
  title: string;
  category: string;
  location: string;
  foundDate: string;
  description: string;
  thumbnailUrl: string | null;
  photoCount: number;
  score: number;
  dayDifference: number;
  reasons: string[];
};

function dayDifference(firstDate: string, secondDate: string): number {
  const first = Date.parse(`${firstDate}T00:00:00.000Z`);
  const second = Date.parse(`${secondDate}T00:00:00.000Z`);
  return Math.floor((second - first) / MILLISECONDS_PER_DAY);
}

function getKeywords(value: string): Set<string> {
  return new Set(normalizeSearchText(value).split(" ").filter(Boolean));
}

function sharedKeywords(report: CreateLostReportInput, item: LostItemRecord): string[] {
  const reportKeywords = getKeywords(`${report.title} ${report.description ?? ""}`);
  const itemKeywords = getKeywords(`${item.title} ${item.description}`);
  return [...reportKeywords].filter((keyword) => itemKeywords.has(keyword)).sort();
}

function locationsMatch(first: string, second: string): boolean {
  const normalizedFirst = normalizeSearchText(first);
  const normalizedSecond = normalizeSearchText(second);
  return normalizedFirst.includes(normalizedSecond) || normalizedSecond.includes(normalizedFirst);
}

export function findLostItemMatches(
  report: CreateLostReportInput,
  items: LostItemRecord[],
): LostItemMatch[] {
  const candidates: LostItemMatch[] = [];

  for (const item of items) {
    if (item.category !== report.category) continue;

    const days = dayDifference(report.lostDate, item.foundDate);
    if (days < 0 || days > MATCH_WINDOW_DAYS) continue;

    const locationMatch = locationsMatch(report.location, item.location);
    const keywords = sharedKeywords(report, item);
    if (!locationMatch && keywords.length === 0) continue;

    const dateBonus = MATCH_WINDOW_DAYS - days;
    const keywordBonus = Math.min(keywords.length * KEYWORD_BONUS, MAX_KEYWORD_BONUS);
    const score = dateBonus + (locationMatch ? LOCATION_BONUS : 0) + keywordBonus;
    const reasons = [`날짜 근접 +${dateBonus}`];
    if (locationMatch) reasons.push(`장소 유사 +${LOCATION_BONUS}`);
    if (keywordBonus > 0) {
      reasons.push(`공통 키워드 ${keywords.length}개 +${keywordBonus}`);
    }

    candidates.push({
      itemId: item.id,
      title: item.title,
      category: item.category,
      location: item.location,
      foundDate: item.foundDate,
      description: item.description,
      thumbnailUrl: item.photoPaths.length > 0 ? `/api/lost-items/${item.id}/photos/0` : null,
      photoCount: item.photoPaths.length,
      score,
      dayDifference: days,
      reasons,
    });
  }

  return candidates
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.dayDifference - second.dayDifference ||
        second.foundDate.localeCompare(first.foundDate) ||
        first.itemId.localeCompare(second.itemId),
    )
    .slice(0, MAX_MATCHES);
}