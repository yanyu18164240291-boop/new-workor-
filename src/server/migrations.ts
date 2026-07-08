import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Database } from './db.ts';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(currentDir, '../../db/migrations/001_initial.sql');

export function runMigrations(db: Database): void {
  db.exec(readFileSync(migrationPath, 'utf8'));
  ensureAuditColumns(db);
}

function ensureAuditColumns(db: Database): void {
  const updatedByTables = [
    'roles',
    'permission_items',
    'role_permission_items',
    'd1_guide_configs',
    'anonymous_feedbacks',
    'anonymous_feedback_modules',
    'anonymous_feedback_problem_types',
    'anonymous_feedback_expected_actions',
    'weekly_feedback_questions',
    'weekly_feedback_options',
    'knowledge_base_docs',
  ];
  for (const table of updatedByTables) {
    addColumnIfMissing(db, table, 'updatedBy', "TEXT NOT NULL DEFAULT 'demo-admin'");
  }
  addColumnIfMissing(db, 'roles', 'departmentId', "TEXT NOT NULL DEFAULT 'dept-collaboration-office'");
  db.exec("UPDATE roles SET departmentId = 'dept-collaboration-office' WHERE departmentId = '' OR departmentId IS NULL;");
  addColumnIfMissing(db, 'roles', 'enabled', 'INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))');
  db.exec('UPDATE roles SET enabled = 1 WHERE enabled IS NULL;');
  addColumnIfMissing(db, 'permission_items', 'ownerType', "TEXT NOT NULL DEFAULT 'department'");
  addColumnIfMissing(db, 'permission_items', 'applyEntryName', "TEXT NOT NULL DEFAULT ''");
  db.exec("UPDATE permission_items SET applyEntryName = name WHERE applyEntryName = '' OR applyEntryName IS NULL;");
  addColumnIfMissing(db, 'anonymous_feedbacks', 'handlerName', 'TEXT');
  addColumnIfMissing(db, 'anonymous_feedbacks', 'handledAt', 'TEXT');
  addColumnIfMissing(db, 'anonymous_feedbacks', 'resolutionNote', 'TEXT');
  addColumnIfMissing(db, 'weekly_feedbacks', 'workSummary', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, 'knowledge_base_docs', 'applicableRoleId', "TEXT NOT NULL DEFAULT 'role-product-intern'");
  addColumnIfMissing(db, 'knowledge_base_docs', 'fileSize', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'knowledge_base_docs', 'fileHash', "TEXT NOT NULL DEFAULT 'mock-md5-pending'");
  addColumnIfMissing(db, 'knowledge_base_docs', 'filePath', "TEXT NOT NULL DEFAULT 'mock-file://selected-admin-doc.pdf'");
  addColumnIfMissing(db, 'knowledge_base_docs', 'contentText', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, 'knowledge_base_docs', 'retrievalKeywords', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, 'd1_guide_configs', 'taskType', "TEXT NOT NULL DEFAULT 'custom_link'");
  addColumnIfMissing(db, 'd1_guide_configs', 'organizationPath', "TEXT NOT NULL DEFAULT '海底捞国际控股有限公司-集团总部-中台业务-技术管理中心-信息技术部-运维与网安组-安全与合规组'");
  addColumnIfMissing(db, 'd1_guide_configs', 'departmentId', "TEXT NOT NULL DEFAULT 'dept-collaboration-office'");
  addColumnIfMissing(db, 'd1_guide_configs', 'departmentName', "TEXT NOT NULL DEFAULT '协同办公部门'");
  addColumnIfMissing(db, 'd1_guide_configs', 'roleId', "TEXT NOT NULL DEFAULT 'role-product-intern'");
  addColumnIfMissing(db, 'd1_guide_configs', 'roleName', "TEXT NOT NULL DEFAULT '协同办公产品实习生'");
  addColumnIfMissing(db, 'd1_guide_configs', 'resourceLinks', "TEXT NOT NULL DEFAULT '[]'");
  db.exec(
    `UPDATE d1_guide_configs
     SET taskType = CASE actionKey
       WHEN 'join_group' THEN 'join_group'
       WHEN 'employee_guide' THEN 'employee_guide'
       WHEN 'permission_package' THEN 'permission_package'
       ELSE COALESCE(NULLIF(taskType, ''), 'custom_link')
     END
     WHERE taskType = 'custom_link' OR taskType IS NULL OR taskType = '';`,
  );
}

function addColumnIfMissing(db: Database, table: string, column: string, definition: string): void {
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  if (!tableExists) return;
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((item) => item.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}
