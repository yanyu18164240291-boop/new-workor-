import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export type Database = DatabaseSync;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function defaultDatabasePath(): string {
  return path.resolve(process.env.HAINA_DB_PATH ?? path.join(projectRoot, 'data/haina-onboarding.db'));
}

export function createDatabase(filePath = defaultDatabasePath()): Database {
  if (filePath !== ':memory:') {
    mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

export function boolFromDb(value: unknown): boolean {
  return value === 1 || value === true;
}

export function boolToDb(value: unknown): number {
  return value === true ? 1 : 0;
}

export function nowIso(): string {
  return new Date().toISOString();
}
