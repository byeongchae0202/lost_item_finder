export const LOST_ITEM_CUSTODY_STATUSES = [
  { value: "held_by_finder", label: "습득자가 보관 중" },
  { value: "department_office", label: "학과 사무실에 맡김" },
  { value: "student_union_office", label: "학생회실에 맡김" },
  { value: "other", label: "기타" },
  { value: "returned", label: "주인에게 전달 완료" },
] as const;

export type LostItemCustodyStatus = (typeof LOST_ITEM_CUSTODY_STATUSES)[number]["value"];

export const DEFAULT_LOST_ITEM_CUSTODY_STATUS: LostItemCustodyStatus = "held_by_finder";

export function isLostItemCustodyStatus(value: string): value is LostItemCustodyStatus {
  return LOST_ITEM_CUSTODY_STATUSES.some((status) => status.value === value);
}

export function getLostItemCustodyStatusLabel(value: LostItemCustodyStatus): string {
  return LOST_ITEM_CUSTODY_STATUSES.find((status) => status.value === value)?.label ?? "습득자가 보관 중";
}
