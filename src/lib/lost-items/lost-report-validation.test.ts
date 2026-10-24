import { describe, expect, it } from "vitest";
import { LostItemValidationError, parseCreateLostReportInput } from "./validation";

const validReport = {
  title: "검은색 지갑",
  category: "지갑/카드",
  location: "중앙 도서관",
  lostDate: "2026-10-20",
};

describe("parseCreateLostReportInput", () => {
  it("accepts the required fields and an optional description", () => {
    expect(parseCreateLostReportInput(validReport, "2026-10-24")).toEqual(validReport);
    expect(
      parseCreateLostReportInput(
        { ...validReport, description: "학생증과 파란 키링" },
        "2026-10-24",
      ).description,
    ).toBe("학생증과 파란 키링");
  });

  it.each(["title", "category", "location", "lostDate"])(
    "requires %s",
    (field) => {
      expect(() =>
        parseCreateLostReportInput({ ...validReport, [field]: " " }, "2026-10-24"),
      ).toThrow(LostItemValidationError);
    },
  );

  it("rejects unsupported categories and future dates", () => {
    expect(() =>
      parseCreateLostReportInput({ ...validReport, category: "음식" }, "2026-10-24"),
    ).toThrow("category must be a supported category.");
    expect(() =>
      parseCreateLostReportInput({ ...validReport, lostDate: "2026-10-25" }, "2026-10-24"),
    ).toThrow("lostDate cannot be in the future.");
  });

  it("rejects invalid calendar dates", () => {
    expect(() =>
      parseCreateLostReportInput({ ...validReport, lostDate: "2026-02-30" }, "2026-10-24"),
    ).toThrow("lostDate must be a valid YYYY-MM-DD date.");
  });
});