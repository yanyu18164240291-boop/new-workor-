import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { createDatabase } from '../src/server/db.ts';
import { runMigrations } from '../src/server/migrations.ts';
import {
  seedD1GuideConfig,
  seedJoinFeishuOrgTasks,
  seedKnowledgeDocStatusGuard,
  seedSubmittedPermissionFollowUps,
  seedWeeklyFeedbackConfig,
} from '../src/server/seed.ts';

const tempDirs: string[] = [];

describe('seed compatibility helpers', () => {
  after(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('adds join_feishu_org task states to existing newcomer rows without reseeding the database', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'haina-seed-compat-'));
    tempDirs.push(tempDir);
    const db = createDatabase(path.join(tempDir, 'test.db'));
    try {
      runMigrations(db);
      db.prepare('INSERT INTO roles (id, name, department, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run(
        'role-product-intern',
        '协同办公产品实习生',
        '协同办公部门',
        '旧库兼容测试岗位',
        '2026-06-19T02:00:00.000Z',
        '2026-06-24T01:00:00.000Z',
      );
      db.prepare(
        `INSERT INTO newcomers
         (id, name, roleId, department, stage, managerName, mentorName, status, d1GuideCompleted, permissionPackageViewed, weeklyFeedbackSubmitted, managerViewedFeedback, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'newcomer-legacy',
        '旧数据新人',
        'role-product-intern',
        '协同办公部门',
        'D7',
        '刘长省',
        '刘长省',
        'onboarding',
        0,
        1,
        0,
        0,
        '2026-06-19T02:00:00.000Z',
        '2026-06-24T01:00:00.000Z',
      );

      seedJoinFeishuOrgTasks(db);

      const row = db
        .prepare('SELECT taskKey, status, completedAt FROM newcomer_task_states WHERE newcomerId = ? AND taskKey = ?')
        .get('newcomer-legacy', 'join_feishu_org') as { taskKey: string; status: string; completedAt: string };
      assert.equal(row.taskKey, 'join_feishu_org');
      assert.equal(row.status, 'completed');
      assert.equal(row.completedAt, '2026-06-19T02:00:00.000Z');
    } finally {
      db.close();
    }
  });

  it('upgrades legacy pending permission applications to submitted records with follow-up tasks', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'haina-seed-compat-'));
    tempDirs.push(tempDir);
    const db = createDatabase(path.join(tempDir, 'test.db'));
    try {
      runMigrations(db);
      db.prepare('INSERT INTO roles (id, name, department, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run(
        'role-product-intern',
        '协同办公产品实习生',
        '协同办公部门',
        '旧库兼容测试岗位',
        '2026-06-19T02:00:00.000Z',
        '2026-06-24T01:00:00.000Z',
      );
      db.prepare(
        `INSERT INTO newcomers
         (id, name, roleId, department, stage, managerName, mentorName, status, d1GuideCompleted, permissionPackageViewed, weeklyFeedbackSubmitted, managerViewedFeedback, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'newcomer-legacy',
        '旧数据新人',
        'role-product-intern',
        '协同办公部门',
        'D2',
        '刘长省',
        '刘长省',
        'onboarding',
        0,
        1,
        0,
        0,
        '2026-06-24T01:00:00.000Z',
        '2026-06-24T01:00:00.000Z',
      );
      db.prepare(
        `INSERT INTO permission_items
         (id, name, category, permissionType, sensitive, ownerName, ownerContact, applyUrl, reasonTemplate, approverName, commonWaitingReasons, enabled, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'perm-legacy',
        '旧权限',
        '办公基础',
        'required',
        0,
        '权限 Owner',
        'owner@example.com',
        'mock://apply',
        '申请理由',
        '审批人',
        '[]',
        1,
        '2026-06-24T01:00:00.000Z',
        '2026-06-24T01:00:00.000Z',
      );
      db.prepare(
        `INSERT INTO permission_progress
         (id, newcomerId, permissionItemId, status, submittedAt, completedAt, lastActionAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'progress-legacy',
        'newcomer-legacy',
        'perm-legacy',
        'pending',
        null,
        null,
        '2026-06-24T02:00:00.000Z',
        '2026-06-24T02:00:00.000Z',
        '2026-06-24T02:00:00.000Z',
      );

      seedSubmittedPermissionFollowUps(db);

      const progress = db.prepare('SELECT status, submittedAt FROM permission_progress WHERE id = ?').get('progress-legacy') as {
        status: string;
        submittedAt: string;
      };
      const followUp = db.prepare('SELECT status, followUpAt FROM follow_up_tasks WHERE permissionProgressId = ?').get('progress-legacy') as {
        status: string;
        followUpAt: string;
      };
      assert.equal(progress.status, 'submitted');
      assert.equal(progress.submittedAt, '2026-06-24T02:00:00.000Z');
      assert.equal(followUp.status, 'pending');
      assert.equal(followUp.followUpAt, '2026-06-24T06:00:00.000Z');
    } finally {
      db.close();
    }
  });

  it('repairs partially missing fixed D1 guide config rows', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'haina-seed-compat-'));
    tempDirs.push(tempDir);
    const db = createDatabase(path.join(tempDir, 'test.db'));
    try {
      runMigrations(db);
      db.prepare(
        `INSERT INTO d1_guide_configs
         (actionKey, title, description, routePath, label, ownerName, enabled, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'permission_package',
        '开通岗位权限包',
        'Only one legacy row exists',
        '/permissions',
        '申请岗位权限',
        'Permission Admin',
        1,
        3,
        '2026-06-24T01:00:00.000Z',
        '2026-06-24T01:00:00.000Z',
      );

      seedD1GuideConfig(db);

      const rows = db.prepare('SELECT actionKey, enabled FROM d1_guide_configs ORDER BY sortOrder').all() as Array<{ actionKey: string; enabled: number }>;
      assert.deepEqual(
        rows.map((row) => row.actionKey),
        ['join_group', 'employee_guide', 'permission_package'],
      );
      const permissionPackage = db.prepare('SELECT label FROM d1_guide_configs WHERE actionKey = ?').get('permission_package') as { label: string };
      assert.equal(permissionPackage.label, '开通岗位权限包');
    } finally {
      db.close();
    }
  });

  it('repairs corrupted fixed D1 guide copy without changing its enabled state', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'haina-seed-compat-'));
    tempDirs.push(tempDir);
    const db = createDatabase(path.join(tempDir, 'test.db'));
    try {
      runMigrations(db);
      db.prepare(
        `INSERT INTO d1_guide_configs
         (actionKey, title, description, routePath, label, ownerName, enabled, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'permission_package',
        '??????',
        'Smoke check',
        '/bad-route',
        '??????',
        'Permission Admin',
        0,
        99,
        '2026-06-24T01:00:00.000Z',
        '2026-06-24T01:00:00.000Z',
      );

      seedD1GuideConfig(db);

      const rows = db.prepare('SELECT actionKey, title, description, routePath, label, enabled, sortOrder FROM d1_guide_configs ORDER BY sortOrder').all() as Array<{
        actionKey: string;
        title: string;
        description: string;
        routePath: string | null;
        label: string;
        enabled: number;
        sortOrder: number;
      }>;
      assert.deepEqual(
        rows.map((row) => row.actionKey),
        ['join_group', 'employee_guide', 'permission_package'],
      );
      const permissionPackage = rows.find((row) => row.actionKey === 'permission_package');
      assert.equal(permissionPackage?.title, '开通岗位权限包');
      assert.equal(permissionPackage?.description, '查看并申请岗位必开权限与可选权限。');
      assert.equal(permissionPackage?.routePath, '/permissions');
      assert.equal(permissionPackage?.label, '开通岗位权限包');
      assert.equal(permissionPackage?.enabled, 0);
      assert.equal(permissionPackage?.sortOrder, 3);
    } finally {
      db.close();
    }
  });

  it('repairs missing or fully disabled weekly feedback config rows', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'haina-seed-compat-'));
    tempDirs.push(tempDir);
    const db = createDatabase(path.join(tempDir, 'test.db'));
    try {
      runMigrations(db);
      db.prepare(
        `INSERT INTO weekly_feedback_questions
         (id, questionKey, title, description, inputType, required, maxLength, enabled, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('wfq-overall', 'overall_feeling', 'Legacy disabled question', '', 'single', 1, null, 0, 1, '2026-06-24T01:00:00.000Z', '2026-06-24T01:00:00.000Z');

      seedWeeklyFeedbackConfig(db);

      const questions = db.prepare('SELECT id, enabled FROM weekly_feedback_questions ORDER BY sortOrder').all() as Array<{ id: string; enabled: number }>;
      const options = db.prepare('SELECT id FROM weekly_feedback_options ORDER BY sortOrder').all() as Array<{ id: string }>;
      assert.deepEqual(
        questions.map((question) => question.id),
        ['wfq-overall', 'wfq-blockers', 'wfq-support', 'wfq-message'],
      );
      assert.ok(questions.some((question) => question.enabled === 1));
      assert.ok(options.length > 0);
    } finally {
      db.close();
    }
  });

  it('soft-disables enabled knowledge docs that are not parsed and vector ready', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'haina-seed-compat-'));
    tempDirs.push(tempDir);
    const db = createDatabase(path.join(tempDir, 'test.db'));
    try {
      runMigrations(db);
      db.prepare('INSERT INTO roles (id, name, department, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run(
        'role-product-intern',
        '协同办公产品实习生',
        '协同办公部门',
        '知识库外键岗位',
        '2026-06-24T01:00:00.000Z',
        '2026-06-24T01:00:00.000Z',
      );
      db.prepare(
        `INSERT INTO knowledge_base_docs
         (id, title, category, applicableRoleId, applicableRole, applicableStage, ownerName, sourceUrl, fileSize, fileHash, filePath, status, parseStatus, vectorStatus, hitCount, createdAt, updatedAt, updatedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'kb-legacy-enabled-pending',
        'Legacy pending enabled doc',
        '入职知识',
        'role-product-intern',
        '协同办公产品实习生',
        'D1',
        'demo-admin',
        'mock-drive://legacy-pending',
        0,
        'mock-md5-legacy-pending',
        'mock-file://legacy-pending.pdf',
        'enabled',
        'pending',
        'ready',
        0,
        '2026-06-24T01:00:00.000Z',
        '2026-06-24T01:00:00.000Z',
        'legacy-admin',
      );
      db.prepare(
        `INSERT INTO knowledge_base_docs
         (id, title, category, applicableRoleId, applicableRole, applicableStage, ownerName, sourceUrl, fileSize, fileHash, filePath, status, parseStatus, vectorStatus, hitCount, createdAt, updatedAt, updatedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'kb-ready-enabled',
        'Ready enabled doc',
        '入职知识',
        'role-product-intern',
        '协同办公产品实习生',
        'D1',
        'demo-admin',
        'mock-drive://ready',
        0,
        'mock-md5-ready',
        'mock-file://ready.pdf',
        'enabled',
        'parsed',
        'ready',
        0,
        '2026-06-24T01:00:00.000Z',
        '2026-06-24T01:00:00.000Z',
        'legacy-admin',
      );

      seedKnowledgeDocStatusGuard(db);

      const pending = db.prepare('SELECT status, updatedBy FROM knowledge_base_docs WHERE id = ?').get('kb-legacy-enabled-pending') as {
        status: string;
        updatedBy: string;
      };
      const ready = db.prepare('SELECT status, updatedBy FROM knowledge_base_docs WHERE id = ?').get('kb-ready-enabled') as {
        status: string;
        updatedBy: string;
      };
      assert.equal(pending.status, 'disabled');
      assert.equal(pending.updatedBy, 'demo-admin');
      assert.equal(ready.status, 'enabled');
      assert.equal(ready.updatedBy, 'legacy-admin');
    } finally {
      db.close();
    }
  });
});
