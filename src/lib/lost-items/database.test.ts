import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  initializeLostItemsDatabase,
  insertLostItem,
  listLostItems,
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