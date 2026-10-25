import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteOwnedLostItem,
  getLostItemDetailsById,
  getLostItemById,
  initializeLostItemsDatabase,
  insertLostReport,
  insertLostItem,
  listLostItems,
  resolveLostItemForReport,
  updateOwnedLostItemCustodyStatus,
} from "./database";
import { searchLostItems } from "./search";

describe("lost item database", () => {
  let database: Database.Database;

  beforeEach(() => {
    database = new Database(":memory:");
    initializeLostItemsDatabase(database);
  });

  afterEach(() => {
    database.close();
  });

  it("saves and reads back a lost item", () => {
    const input = {
      title: "검은색 지갑",
      category: "지갑/카드" as const,
      location: "중앙 도서관",
      description: "학생증이 들어 있습니다.",
      foundDate: "2026-10-24",
    };
    const item = insertLostItem(database, input, {
      createdAt: "2026-10-24T08:30:00.000Z",
    });

    expect(item).toMatchObject({
      ...input,
      photoPaths: [],
      createdAt: "2026-10-24T08:30:00.000Z",
    });
    expect(item.id).toMatch(/^[\da-f-]{36}$/i);
    expect(listLostItems(database)).toEqual([item]);
  });

  it("creates the private lost report table without changing the found items table", () => {
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const lostReportColumns = database
      .prepare("PRAGMA table_info(lost_reports)")
      .all() as { name: string }[];

    expect(tables.map((table) => table.name)).toContain("lost_items");
    expect(lostReportColumns.map((column) => column.name)).toEqual([
      "id",
      "title",
      "category",
      "location",
      "lost_date",
      "description",
      "photo_paths",
      "owner_token_hash",
      "created_at",
    ]);
  });

  it("adds lost report storage when opening a legacy database", () => {
    const legacyDatabase = new Database(":memory:");
    legacyDatabase.exec(`
      CREATE TABLE lost_items (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT NOT NULL,
        found_date TEXT NOT NULL,
        photo_paths TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );
    `);

    initializeLostItemsDatabase(legacyDatabase);
    const reportTable = legacyDatabase
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'lost_reports'")
      .get();
    const lostItemColumns = legacyDatabase
      .prepare("PRAGMA table_info(lost_items)")
      .all() as { name: string }[];
    legacyDatabase.close();

    expect(reportTable).toBeTruthy();
    expect(lostItemColumns.map((column) => column.name)).toContain("owner_token_hash");
    expect(lostItemColumns.map((column) => column.name)).toContain("status");
    expect(lostItemColumns.map((column) => column.name)).toContain("custody_status");
  });

  it("stores owner-edited custody status and hides returned items", () => {
    const item = insertLostItem(
      database,
      {
        title: "검정색 지갑",
        category: "지갑/카드",
        location: "중앙 도서관",
        description: "학생증 포함",
        foundDate: "2000-01-01",
      },
      { ownerTokenHash: "owner-hash" },
    );

    expect(item.custodyStatus).toBe("held_by_finder");
    expect(updateOwnedLostItemCustodyStatus(database, item.id, "wrong-hash", "department_office")).toBe(false);
    expect(updateOwnedLostItemCustodyStatus(database, item.id, "owner-hash", "department_office")).toBe(true);
    expect(getLostItemById(database, item.id)?.custodyStatus).toBe("department_office");
    expect(updateOwnedLostItemCustodyStatus(database, item.id, "owner-hash", "returned")).toBe(true);
    expect(listLostItems(database)).toEqual([]);
    expect(getLostItemById(database, item.id)).toBeNull();
    expect(getLostItemDetailsById(database, item.id)?.custodyStatus).toBe("returned");
  });

  it("maps previously resolved posts to the completed custody status", () => {
    const item = insertLostItem(
      database,
      {
        title: "기존 완료 항목",
        category: "기타 물품",
        location: "안내데스크",
        description: "이전 완료 상태",
        foundDate: "2000-01-01",
      },
    );
    database.prepare("UPDATE lost_items SET status = 'resolved' WHERE id = ?").run(item.id);

    initializeLostItemsDatabase(database);

    expect(getLostItemDetailsById(database, item.id)?.custodyStatus).toBe("returned");
    expect(listLostItems(database)).toEqual([]);
  });

  it("deletes a found item only when the owner token hash matches", () => {
    const item = insertLostItem(
      database,
      {
        title: "검은색 지갑",
        category: "지갑/카드",
        location: "중앙 도서관",
        description: "학생증 포함",
        foundDate: "2000-01-01",
      },
      { ownerTokenHash: "owner-hash", photoPaths: ["photo.png"] },
    );

    expect(deleteOwnedLostItem(database, item.id, "someone-else")).toBeNull();
    expect(listLostItems(database)).toHaveLength(1);
    expect(deleteOwnedLostItem(database, item.id, "owner-hash")).toEqual(["photo.png"]);
    expect(listLostItems(database)).toEqual([]);
  });

  it("hides a claimed found item from future lists and matches", () => {
    const item = insertLostItem(
      database,
      {
        title: "검은색 태블릿",
        category: "전자기기",
        location: "공학관",
        description: "파란 케이스",
        foundDate: "2026-10-20",
      },
      { photoPaths: ["found.png"] },
    );
    const report = insertLostReport(
      database,
      {
        title: "검은색 태블릿",
        category: "전자기기",
        location: "공학관",
        lostDate: "2026-10-20",
      },
      "report-owner-hash",
    );

    expect(resolveLostItemForReport(database, item.id, report.id, "wrong-hash")).toBeNull();
    expect(resolveLostItemForReport(database, item.id, report.id, "report-owner-hash")).toEqual([
      "found.png",
    ]);
    expect(listLostItems(database)).toEqual([]);
    expect(getLostItemById(database, item.id)).toBeNull();
  });

  it("stores owner token hashes and optional report photos without exposing them as item fields", () => {
    const report = insertLostReport(
      database,
      {
        title: "검은색 지갑",
        category: "지갑/카드",
        location: "중앙 도서관",
        lostDate: "2026-10-20",
      },
      "owner-token-hash",
      { photoPaths: ["lost-photo.png"] },
    );

    expect(report).toMatchObject({
      title: "검은색 지갑",
      lostDate: "2026-10-20",
      description: undefined,
      photoPaths: ["lost-photo.png"],
      ownerTokenHash: "owner-token-hash",
    });
  });

  it("makes newly saved items available to keyword search", () => {
    const input = {
      title: "검은색 지갑",
      category: "지갑/카드" as const,
      location: "중앙 도서관",
      description: "학생증과 파란 키링이 들어 있습니다.",
      foundDate: "2000-01-01",
    };
    insertLostItem(database, input);

    expect(
      searchLostItems(listLostItems(database), { keyword: "학생증 도서관" }),
    ).toHaveLength(1);
  });

  it("orders multiple items by found date, then creation time", () => {
    const base = {
      category: "전자기기" as const,
      location: "공학관",
      description: "검은색",
    };

    insertLostItem(
      database,
      { ...base, title: "오래된 물건", foundDate: "2026-10-20" },
      { createdAt: "2026-10-20T08:00:00.000Z" },
    );
    insertLostItem(
      database,
      { ...base, title: "최근 습득", foundDate: "2026-10-24" },
      { createdAt: "2026-10-24T08:00:00.000Z" },
    );

    expect(listLostItems(database).map((item) => item.title)).toEqual([
      "최근 습득",
      "오래된 물건",
    ]);
  });
});