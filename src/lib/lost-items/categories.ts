export const ITEM_CATEGORIES = [
  {
    id: "electronics",
    label: "전자기기",
    examples: "휴대폰, 태블릿, 에어팟, 충전기",
  },
  {
    id: "wallet-card",
    label: "지갑/카드",
    examples: "학생증, 신분증, 신용카드, 지갑",
  },
  {
    id: "school-supplies",
    label: "학용품/도서",
    examples: "전공책, 노트, 필통, 계산기",
  },
  {
    id: "clothing-accessories",
    label: "의류/잡화",
    examples: "패딩, 후드티, 모자, 우산, 안경",
  },
  {
    id: "keys-misc",
    label: "열쇠/기타",
    examples: "사물함 열쇠, 자전거 자물쇠, 파우치",
  },
  {
    id: "other",
    label: "기타 물품",
    examples: "분류에 맞지 않는 물건",
  },
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number]["label"];

export function isItemCategory(value: string): value is ItemCategory {
  return ITEM_CATEGORIES.some((category) => category.label === value);
}