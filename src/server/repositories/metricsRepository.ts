import type { Database } from '../db.ts';

export function count(db: Database, table: string): number {
  return Number((db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total);
}
