import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Database = DatabaseSync;

export function createDatabase(filePath = path.resolve('data/haina-onboarding.db')): Database {
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
