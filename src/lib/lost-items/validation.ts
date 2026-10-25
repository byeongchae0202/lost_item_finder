import { isItemCategory, type ItemCategory } from "./categories";
import {
  DEFAULT_LOST_ITEM_CUSTODY_STATUS,
  isLostItemCustodyStatus,
  type LostItemCustodyStatus,
} from "./custody-status";

export type CreateLostReportInput = {
  title: string;
  category: ItemCategory;
  location: string;
  lostDate: string;
  description?: string;
};

export type CreateLostItemInput = {
  title: string;
  category: ItemCategory;
  location: string;
  description: string;
  foundDate: string;
  custodyStatus?: LostItemCustodyStatus;
};

export class LostItemValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LostItemValidationError";
  }
}

export function getTodayDateString(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function requiredText(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LostItemValidationError(`${field} is required.`);
  }

  return value.trim();
}

export function parseCreateLostItemInput(
  value: unknown,
  today = getTodayDateString(),
): CreateLostItemInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new LostItemValidationError("A JSON object is required.");
  }

  const input = value as Record<string, unknown>;
  const title = requiredText(input, "title");
  const category = requiredText(input, "category");
  if (!isItemCategory(category)) {
    throw new LostItemValidationError("category must be a supported category.");
  }
  const location = requiredText(input, "location");
  const description = requiredText(input, "description");
  const foundDate = requiredText(input, "foundDate");

  if (!isValidDateString(foundDate)) {
    throw new LostItemValidationError("foundDate must be a valid YYYY-MM-DD date.");
  }

  if (foundDate > today) {
    throw new LostItemValidationError("foundDate cannot be in the future.");
  }

  const custodyStatusValue = input.custodyStatus;
  if (
    custodyStatusValue !== undefined &&
    (typeof custodyStatusValue !== "string" || !isLostItemCustodyStatus(custodyStatusValue))
  ) {
    throw new LostItemValidationError("custodyStatus is not supported.");
  }

  return {
    title,
    category,
    location,
    description,
    foundDate,
    custodyStatus: (custodyStatusValue as LostItemCustodyStatus | undefined) ?? DEFAULT_LOST_ITEM_CUSTODY_STATUS,
  };
}

export function parseCreateLostReportInput(
  value: unknown,
  today = getTodayDateString(),
): CreateLostReportInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new LostItemValidationError("A JSON object is required.");
  }

  const input = value as Record<string, unknown>;
  const title = requiredText(input, "title");
  const category = requiredText(input, "category");
  if (!isItemCategory(category)) {
    throw new LostItemValidationError("category must be a supported category.");
  }

  const location = requiredText(input, "location");
  const lostDate = requiredText(input, "lostDate");
  if (!isValidDateString(lostDate)) {
    throw new LostItemValidationError("lostDate must be a valid YYYY-MM-DD date.");
  }
  if (lostDate > today) {
    throw new LostItemValidationError("lostDate cannot be in the future.");
  }

  const descriptionValue = input.description;
  if (descriptionValue !== undefined && typeof descriptionValue !== "string") {
    throw new LostItemValidationError("description must be text.");
  }
  const description = typeof descriptionValue === "string" ? descriptionValue.trim() : "";

  if (title.length > 80 || location.length > 120 || description.length > 1000) {
    throw new LostItemValidationError("One or more fields exceed the maximum length.");
  }

  return {
    title,
    category,
    location,
    lostDate,
    ...(description ? { description } : {}),
  };
}
