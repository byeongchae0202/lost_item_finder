import { describe, expect, it } from "vitest";
import {
  getTodayDateString,
  LostItemValidationError,
  parseCreateLostItemInput,
} from "./validation";

const validInput = {
  title: "검은색 지갑",
  category: "지갑/카드",
  location: "중앙 도서관",
  description: "학생증이 들어 있습니다.",
  foundDate: "2026-10-24",
};

describe("parseCreateLostItemInput", () => {
  it("trims required text fields", () => {
    const result = parseCreateLostItemInput(
      { ...validInput, title: "  검은색 지갑  " },
      "2026-10-24",
    );

    expect(result.title).toBe("검은색 지갑");
  });

  it.each(["title", "category", "location", "description", "foundDate"])(
    "requires %s",
    (field) => {
      const input = { ...validInput, [field]: " " };

      expect(() => parseCreateLostItemInput(input, "2026-10-24")).toThrow(
        LostItemValidationError,
      );
    },
  );

  it("accepts today and past dates", () => {
    expect(() =>
      parseCreateLostItemInput({ ...validInput, foundDate: "2026-10-24" }, "2026-10-24"),
    ).not.toThrow();
    expect(() =>
      parseCreateLostItemInput({ ...validInput, foundDate: "2026-02-28" }, "2026-10-24"),
    ).not.toThrow();
  });

  it("rejects unsupported categories", () => {
    expect(() =>
      parseCreateLostItemInput({ ...validInput, category: "음식" }, "2026-10-24"),
    ).toThrow("category must be a supported category.");
  });

  it("defaults and accepts the five supported custody statuses", () => {
    expect(parseCreateLostItemInput(validInput, "2026-10-24").custodyStatus).toBe("held_by_finder");
    for (const custodyStatus of ["held_by_finder", "department_office", "student_union_office", "other", "returned"]) {
      expect(parseCreateLostItemInput({
        ...validInput,
        custodyStatus,
        ...(custodyStatus === "other" ? { custodyNote: "본관 안내데스크" } : {}),
      }, "2026-10-24").custodyStatus)
        .toBe(custodyStatus);
    }
    expect(() =>
      parseCreateLostItemInput({ ...validInput, custodyStatus: "lost" }, "2026-10-24"),
    ).toThrow("custodyStatus is not supported.");
    expect(() =>
      parseCreateLostItemInput({ ...validInput, custodyStatus: "other" }, "2026-10-24"),
    ).toThrow("custodyNote is required for the other status.");
    expect(parseCreateLostItemInput({
      ...validInput,
      custodyStatus: "other",
      custodyNote: "  본관 안내데스크  ",
    }, "2026-10-24").custodyNote).toBe("본관 안내데스크");
    expect(() =>
      parseCreateLostItemInput({ ...validInput, custodyStatus: "other", custodyNote: "가".repeat(81) }, "2026-10-24"),
    ).toThrow("custodyNote must be 80 characters or fewer.");
  });

  it("rejects invalid calendar dates", () => {
    expect(() =>
      parseCreateLostItemInput({ ...validInput, foundDate: "2026-02-30" }, "2026-10-24"),
    ).toThrow("foundDate must be a valid YYYY-MM-DD date.");
  });

  it("rejects dates after today", () => {
    expect(() =>
      parseCreateLostItemInput({ ...validInput, foundDate: "2026-10-25" }, "2026-10-24"),
    ).toThrow("foundDate cannot be in the future.");
  });
});

describe("getTodayDateString", () => {
  it("uses the local calendar date", () => {
    expect(getTodayDateString(new Date(2026, 0, 2, 23, 30))).toBe("2026-01-02");
  });
});
