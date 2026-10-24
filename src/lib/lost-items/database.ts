import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { ItemCategory } from "./categories";
import type { CreateLostItemInput } from "./validation";

export type LostItemRecord = CreateLostItemInput & {
  id: string;
  photoPaths: string[];
  createdAt: string;
};

type LostItemRow = {
  id: string;
  title: string;
  category: string;
  location: string;
  description: string;
  found_date: string;
  photo_paths: string;
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
      created_at TEXT NOT NULL
    );
  `);
}

export function getLostItemsDatabase(): Database.Database {
  if (globalWithLostItemsDatabase.lostItemsDatabase) {
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
    createdAt: row.created_at,
  };
}

export function insertLostItem(
  database: Database.Database,
  input: CreateLostItemInput,
  options: { createdAt?: string; photoPaths?: string[] } = {},
): LostItemRecord {
  const id = randomUUID();
  const createdAt = options.createdAt ?? new Date().toISOString();
  const photoPaths = options.photoPaths ?? [];
  database
    .prepare(
      `INSERT INTO lost_items
        (id, title, category, location, description, found_date, photo_paths, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.title,
      input.category,
      input.location,
      input.description,
      input.foundDate,
      JSON.stringify(photoPaths),
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
    .prepare("SELECT * FROM lost_items ORDER BY found_date DESC, created_at DESC")
    .all() as LostItemRow[];

  return rows.map(mapLostItem);
}

export function getLostItemById(database: Database.Database, id: string): LostItemRecord | null {
  const row = database
    .prepare("SELECT * FROM lost_items WHERE id = ?")
    .get(id) as LostItemRow | undefined;

  return row ? mapLostItem(row) : null;
}

export function createLostItem(
  input: CreateLostItemInput,
  photoPaths: string[] = [],
): LostItemRecord {
  return insertLostItem(getLostItemsDatabase(), input, { photoPaths });
}

export function getAllLostItems(): LostItemRecord[] {
  return listLostItems(getLostItemsDatabase());
}

export function getLostItem(id: string): LostItemRecord | null {
  return getLostItemById(getLostItemsDatabase(), id);
}