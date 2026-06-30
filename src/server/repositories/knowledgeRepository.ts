import type { Database } from '../db.ts';
import { createdId, normalizeRow, normalizeRows, nowIso, sqlValue } from '../routeKit.ts';

export type CreateKnowledgeDocInput = {
  id?: string;
  title: string;
  category: string;
  applicableRoleId: string;
  applicableRole: string;
  applicableStage: string;
  sourceUrl: string;
  fileSize: number;
  fileHash: string;
  filePath: string;
  ownerName: string;
  updatedBy: string;
};

export function listKnowledgeDocs(db: Database): Array<Record<string, unknown>> {
  return normalizeRows(db.prepare('SELECT * FROM knowledge_base_docs ORDER BY updatedAt DESC').all() as Array<Record<string, unknown>>);
}

export function getKnowledgeDoc(db: Database, id: string): Record<string, unknown> | undefined {
  return normalizeRow(db.prepare('SELECT * FROM knowledge_base_docs WHERE id = ?').get(id) as Record<string, unknown> | undefined);
}

export function createKnowledgeDoc(db: Database, input: CreateKnowledgeDocInput): Record<string, unknown> {
  const time = nowIso();
  const id = input.id ?? createdId('kb');
  db.prepare(
    `INSERT INTO knowledge_base_docs
     (id, title, category, applicableRoleId, applicableRole, applicableStage, sourceUrl, fileSize, fileHash, filePath,
      ownerName, status, parseStatus, vectorStatus, hitCount, updatedAt, createdAt, updatedBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    sqlValue(input.title),
    sqlValue(input.category),
    sqlValue(input.applicableRoleId),
    sqlValue(input.applicableRole),
    sqlValue(input.applicableStage),
    sqlValue(input.sourceUrl),
    input.fileSize,
    sqlValue(input.fileHash),
    sqlValue(input.filePath),
    sqlValue(input.ownerName),
    'disabled',
    'pending',
    'pending',
    0,
    time,
    time,
    sqlValue(input.updatedBy),
  );
  return getKnowledgeDoc(db, id)!;
}

export function markKnowledgeDocParsed(db: Database, id: string, updatedBy: string): Record<string, unknown> | undefined {
  const time = nowIso();
  db.prepare('UPDATE knowledge_base_docs SET parseStatus = ?, vectorStatus = ?, updatedAt = ?, updatedBy = ? WHERE id = ?').run(
    'parsed',
    'ready',
    time,
    updatedBy,
    id,
  );
  return getKnowledgeDoc(db, id);
}

export function updateKnowledgeDocStatus(db: Database, id: string, status: string, updatedBy: string): Record<string, unknown> | undefined {
  const time = nowIso();
  db.prepare('UPDATE knowledge_base_docs SET status = ?, updatedAt = ?, updatedBy = ? WHERE id = ?').run(status, time, updatedBy, id);
  return getKnowledgeDoc(db, id);
}
