import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { ItemCategory } from "./categories";
import { DEFAULT_LOST_ITEM_CUSTODY_STATUS, type LostItemCustodyStatus } from "./custody-status";
import type { CreateLostItemInput, CreateLostReportInput } from "./validation";

export type LostItemRecord = CreateLostItemInput & {
  id: string;
  photoPaths: string[];
  custodyStatus: LostItemCustodyStatus;
  createdAt: string;
};

export type LostReportRecord = CreateLostReportInput & {
  id: string;
  photoPaths: string[];
  createdAt: string;
};

export type PrivateLostReportRecord = LostReportRecord & {
  ownerTokenHash: string;
};

type LostItemRow = {
  id: string;
  title: string;
  category: string;
  location: string;
  description: string;
  found_date: string;
  photo_paths: string;
  owner_token_hash: string | null;
  status: "available" | "resolved";
  custody_status: LostItemCustodyStatus;
  custody_note: string | null;
  created_at: string;
};

type LostReportRow = {
  id: string;
  title: string;
  category: string;
  location: string;
  lost_date: string;
  description: string | null;
  photo_paths: string;
  owner_token_hash: string;
  created_at: string;
};

type GlobalWithLostItemsDatabase = typeof globalThis & {
  lostItemsDatabase?: Database.Database;
};

const globalWithLostItemsDatabase = globalThis as GlobalWithLostItemsDatabase;

export function initializeLostItemsDatabase(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS lost_items (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT NOT NULL,
      found_date TEXT NOT NULL,
      photo_paths TEXT NOT NULL DEFAULT '[]',
      owner_token_hash TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      custody_status TEXT NOT NULL DEFAULT 'held_by_finder',
      custody_note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lost_reports (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      lost_date TEXT NOT NULL,
      description TEXT,
      photo_paths TEXT NOT NULL DEFAULT '[]',
      owner_token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS lost_reports_owner_token_hash_idx
      ON lost_reports(owner_token_hash);
  `);

  const lostItemColumns = database
    .prepare("PRAGMA table_info(lost_items)")
    .all() as { name: string }[];
  const columnNames = new Set(lostItemColumns.map((column) => column.name));
  if (!columnNames.has("owner_token_hash")) {
    database.exec("ALTER TABLE lost_items ADD COLUMN owner_token_hash TEXT");
  }
  if (!columnNames.has("status")) {
    database.exec("ALTER TABLE lost_items ADD COLUMN status TEXT NOT NULL DEFAULT 'available'");
  }
  if (!columnNames.has("custody_status")) {
    database.exec("ALTER TABLE lost_items ADD COLUMN custody_status TEXT NOT NULL DEFAULT 'held_by_finder'");
  }
  if (!columnNames.has("custody_note")) {
    database.exec("ALTER TABLE lost_items ADD COLUMN custody_note TEXT");
  }
  database.exec(
    "UPDATE lost_items SET custody_status = 'returned' WHERE status = 'resolved' AND custody_status = 'held_by_finder'",
  );
}

export function getLostItemsDatabase(): Database.Database {
  if (globalWithLostItemsDatabase.lostItemsDatabase) {
    initializeLostItemsDatabase(globalWithLostItemsDatabase.lostItemsDatabase);
    return globalWithLostItemsDatabase.lostItemsDatabase;
  }

  const dataDirectory = path.join(process.cwd(), "data");
  mkdirSync(dataDirectory, { recursive: true });

  const database = new Database(path.join(dataDirectory, "lost-items.sqlite"));
  database.pragma("journal_mode = WAL");
  initializeLostItemsDatabase(database);
  globalWithLostItemsDatabase.lostItemsDatabase = database;

  return database;
}

function mapLostItem(row: LostItemRow): LostItemRecord {
  return {
    id: row.id,
    title: row.title,
    category: row.category as ItemCategory,
    location: row.location,
    description: row.description,
    foundDate: row.found_date,
    photoPaths: JSON.parse(row.photo_paths) as string[],
    custodyStatus: row.custody_status ?? DEFAULT_LOST_ITEM_CUSTODY_STATUS,
    custodyNote: row.custody_note ?? undefined,
    createdAt: row.created_at,
  };
}

export function insertLostItem(
  database: Database.Database,
  input: CreateLostItemInput,
  options: {
    createdAt?: string;
    photoPaths?: string[];
    ownerTokenHash?: string;
    custodyStatus?: LostItemCustodyStatus;
    custodyNote?: string;
  } = {},
): LostItemRecord {
  const id = randomUUID();
  const createdAt = options.createdAt ?? new Date().toISOString();
  const photoPaths = options.photoPaths ?? [];
  const custodyStatus = options.custodyStatus ?? input.custodyStatus ?? DEFAULT_LOST_ITEM_CUSTODY_STATUS;
  const visibilityStatus = custodyStatus === "returned" ? "resolved" : "available";
  database
    .prepare(
      `INSERT INTO lost_items
        (id, title, category, location, description, found_date, photo_paths, owner_token_hash, status, custody_status, custody_note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.title,
      input.category,
      input.location,
      input.description,
      input.foundDate,
      JSON.stringify(photoPaths),
      options.ownerTokenHash ?? null,
      visibilityStatus,
      custodyStatus,
      options.custodyNote ?? input.custodyNote ?? null,
      createdAt,
    );

  const row = database
    .prepare("SELECT * FROM lost_items WHERE id = ?")
    .get(id) as LostItemRow | undefined;

  if (!row) {
    throw new Error("The saved lost item could not be read back.");
  }

  return mapLostItem(row);
}

export function listLostItems(database: Database.Database): LostItemRecord[] {
  const rows = database
    .prepare("SELECT * FROM lost_items WHERE status = 'available' AND custody_status != 'returned' ORDER BY found_date DESC, created_at DESC")
    .all() as LostItemRow[];

  return rows.map(mapLostItem);
}

export function getLostItemById(database: Database.Database, id: string): LostItemRecord | null {
  const row = database
    .prepare("SELECT * FROM lost_items WHERE id = ? AND status = 'available' AND custody_status != 'returned'")
    .get(id) as LostItemRow | undefined;

  return row ? mapLostItem(row) : null;
}

export function getLostItemDetailsById(database: Database.Database, id: string): LostItemRecord | null {
  const row = database
    .prepare("SELECT * FROM lost_items WHERE id = ?")
    .get(id) as LostItemRow | undefined;

  return row ? mapLostItem(row) : null;
}

export function createLostItem(
  input: CreateLostItemInput,
  photoPaths: string[] = [],
  ownerTokenHash?: string,
): LostItemRecord {
  return insertLostItem(getLostItemsDatabase(), input, { photoPaths, ownerTokenHash });
}

export function getAllLostItems(): LostItemRecord[] {
  return listLostItems(getLostItemsDatabase());
}

export function getLostItem(id: string): LostItemRecord | null {
  return getLostItemById(getLostItemsDatabase(), id);
}

export function getLostItemOwnerTokenHash(id: string): string | null {
  const row = getLostItemsDatabase()
    .prepare("SELECT owner_token_hash FROM lost_items WHERE id = ?")
    .get(id) as { owner_token_hash: string | null } | undefined;

  return row?.owner_token_hash ?? null;
}

export function updateOwnedLostItemCustodyStatus(
  database: Database.Database,
  id: string,
  ownerTokenHash: string,
  custodyStatus: LostItemCustodyStatus,
  custodyNote?: string,
): boolean {
  const visibilityStatus = custodyStatus === "returned" ? "resolved" : "available";
  const result = database
    .prepare(
      `UPDATE lost_items
      SET custody_status = ?, custody_note = ?, status = ?
       WHERE id = ? AND owner_token_hash = ? AND status = 'available'`,
    )
    .run(custodyStatus, custodyNote ?? null, visibilityStatus, id, ownerTokenHash);

  return result.changes > 0;
}

export function resolveLostItemById(database: Database.Database, id: string): string[] | null {
  const row = database
    .prepare("SELECT photo_paths FROM lost_items WHERE id = ? AND status = 'available'")
    .get(id) as { photo_paths: string } | undefined;
  if (!row) return null;

  const result = database
    .prepare("UPDATE lost_items SET status = 'resolved', custody_status = 'returned' WHERE id = ? AND status = 'available'")
    .run(id);
  return result.changes > 0 ? (JSON.parse(row.photo_paths) as string[]) : null;
}

export function deleteOwnedLostItem(
  database: Database.Database,
  id: string,
  ownerTokenHash: string,
): string[] | null {
  const transaction = database.transaction(() => {
    const row = database
      .prepare("SELECT photo_paths FROM lost_items WHERE id = ? AND status = 'available' AND owner_token_hash = ?")
      .get(id, ownerTokenHash) as { photo_paths: string } | undefined;
    if (!row) return null;

    const result = database
      .prepare("DELETE FROM lost_items WHERE id = ? AND status = 'available' AND owner_token_hash = ?")
      .run(id, ownerTokenHash);
    return result.changes > 0 ? (JSON.parse(row.photo_paths) as string[]) : null;
  });

  return transaction();
}

export function resolveLostItemForReport(
  database: Database.Database,
  id: string,
  reportId: string,
  ownerTokenHash: string,
): string[] | null {
  const transaction = database.transaction(() => {
    const report = database
      .prepare("SELECT id FROM lost_reports WHERE id = ? AND owner_token_hash = ?")
      .get(reportId, ownerTokenHash);
    if (!report) return null;

    const row = database
      .prepare("SELECT photo_paths FROM lost_items WHERE id = ? AND status = 'available'")
      .get(id) as { photo_paths: string } | undefined;
    if (!row) return null;

    const result = database
      .prepare("UPDATE lost_items SET status = 'resolved', custody_status = 'returned' WHERE id = ? AND status = 'available'")
      .run(id);
    return result.changes > 0 ? (JSON.parse(row.photo_paths) as string[]) : null;
  });

  return transaction();
}

function mapLostReport(row: LostReportRow): PrivateLostReportRecord {
  return {
    id: row.id,
    title: row.title,
    category: row.category as ItemCategory,
    location: row.location,
    lostDate: row.lost_date,
    description: row.description ?? undefined,
    photoPaths: JSON.parse(row.photo_paths) as string[],
    ownerTokenHash: row.owner_token_hash,
    createdAt: row.created_at,
  };
}

export function insertLostReport(
  database: Database.Database,
  input: CreateLostReportInput,
  ownerTokenHash: string,
  options: { createdAt?: string; photoPaths?: string[] } = {},
): PrivateLostReportRecord {
  const id = randomUUID();
  const createdAt = options.createdAt ?? new Date().toISOString();
  const photoPaths = options.photoPaths ?? [];

  database
    .prepare(
      `INSERT INTO lost_reports
        (id, title, category, location, lost_date, description, photo_paths, owner_token_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.title,
      input.category,
      input.location,
      input.lostDate,
      input.description ?? null,
      JSON.stringify(photoPaths),
      ownerTokenHash,
      createdAt,
    );

  const row = database
    .prepare("SELECT * FROM lost_reports WHERE id = ?")
    .get(id) as LostReportRow | undefined;

  if (!row) {
    throw new Error("The saved lost report could not be read back.");
  }

  return mapLostReport(row);
}

export function getLostReportById(
  database: Database.Database,
  id: string,
): PrivateLostReportRecord | null {
  const row = database
    .prepare("SELECT * FROM lost_reports WHERE id = ?")
    .get(id) as LostReportRow | undefined;

  return row ? mapLostReport(row) : null;
}

export function createLostReport(
  input: CreateLostReportInput,
  ownerTokenHash: string,
  photoPaths: string[] = [],
): LostReportRecord {
  const report = insertLostReport(getLostItemsDatabase(), input, ownerTokenHash, { photoPaths });
  return {
    id: report.id,
    title: report.title,
    category: report.category,
    location: report.location,
    lostDate: report.lostDate,
    description: report.description,
    photoPaths: report.photoPaths,
    createdAt: report.createdAt,
  };
}

export function getLostReport(id: string): PrivateLostReportRecord | null {
  return getLostReportById(getLostItemsDatabase(), id);
}