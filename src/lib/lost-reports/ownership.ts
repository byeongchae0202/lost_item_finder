import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createReportOwnerToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashReportOwnerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyReportOwnerToken(token: string | undefined, storedHash: string): boolean {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[a-f\d]{64}$/i.test(storedHash)) {
    return false;
  }

  const tokenHash = Buffer.from(hashReportOwnerToken(token), "hex");
  const expectedHash = Buffer.from(storedHash, "hex");
  return timingSafeEqual(tokenHash, expectedHash);
}

export function reportOwnerCookieName(reportId: string): string {
  return `lost-report-owner-${reportId}`;
}

export function lostItemOwnerCookieName(itemId: string): string {
  return `lost-item-owner-${itemId}`;
}