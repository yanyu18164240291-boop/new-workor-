import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Database } from './db.ts';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(currentDir, '../../db/migrations/001_initial.sql');

export function runMigrations(db: Database): void {
  db.exec(readFileSync(migrationPath, 'utf8'));
}
