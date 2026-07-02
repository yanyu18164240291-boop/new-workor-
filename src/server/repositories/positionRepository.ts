import type { Database } from '../db.ts';
import { createdId, normalizeRow, normalizeRows, nowIso, sqlValue } from '../routeKit.ts';

export type CreatePositionInput = {
  name: string;
  departmentId: string;
  department: string;
  description: string;
  enabled?: boolean;
  updatedBy: string;
};

export function listPositions(db: Database): Array<Record<string, unknown>> {
  return normalizeRows(db.prepare('SELECT * FROM roles ORDER BY createdAt').all() as Array<Record<string, unknown>>);
}

export function findPositionByName(db: Database, name: string): Record<string, unknown> | undefined {
  return normalizeRow(db.prepare('SELECT * FROM roles WHERE name = ? COLLATE NOCASE').get(name) as Record<string, unknown> | undefined);
}

export function createPosition(db: Database, input: CreatePositionInput): Record<string, unknown> {
  const time = nowIso();
  const id = createdId('role');
  db.prepare(
    `INSERT INTO roles
     (id, name, departmentId, department, description, enabled, createdAt, updatedAt, updatedBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    sqlValue(input.name),
    sqlValue(input.departmentId),
    sqlValue(input.department),
    sqlValue(input.description),
    sqlValue(input.enabled ?? true),
    time,
    time,
    sqlValue(input.updatedBy),
  );
  return normalizeRow(db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as Record<string, unknown>)!;
}
