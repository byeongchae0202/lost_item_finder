import { describe, expect, it } from "vitest";
import {
  createReportOwnerToken,
  hashReportOwnerToken,
  reportOwnerCookieName,
  verifyReportOwnerToken,
} from "./ownership";

describe("lost report ownership tokens", () => {
  it("creates an unpredictable token and verifies its hash", () => {
    const token = createReportOwnerToken();
    const tokenHash = hashReportOwnerToken(token);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toMatch(/^[a-f\d]{64}$/);
    expect(verifyReportOwnerToken(token, tokenHash)).toBe(true);
    expect(verifyReportOwnerToken(`${token}x`, tokenHash)).toBe(false);
  });

  it("rejects missing and malformed tokens", () => {
    expect(verifyReportOwnerToken(undefined, "a".repeat(64))).toBe(false);
    expect(verifyReportOwnerToken("not-a-token", "a".repeat(64))).toBe(false);
    expect(verifyReportOwnerToken(createReportOwnerToken(), "bad-hash")).toBe(false);
  });

  it("uses a per-report cookie name", () => {
    expect(reportOwnerCookieName("report-123")).toBe("lost-report-owner-report-123");
  });
});