import type { Database } from '../db.ts';
import { normalizeRow } from '../routeKit.ts';

export function getPermission(db: Database, id: string): Record<string, unknown> | undefined {
  return normalizeRow(db.prepare('SELECT * FROM permission_items WHERE id = ?').get(id) as Record<string, unknown> | undefined);
}
