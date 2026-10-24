import { isItemCategory, type ItemCategory } from "./categories";

export type CreateLostItemInput = {
  title: string;
  category: ItemCategory;
  location: string;
  description: string;
  foundDate: string;
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

  return { title, category, location, description, foundDate };
}
