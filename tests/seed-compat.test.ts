import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { createDatabase } from '../src/server/db.ts';
import { runMigrations } from '../src/server/migrations.ts';
import { seedJoinFeishuOrgTasks, seedSubmittedPermissionFollowUps } from '../src/server/seed.ts';

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
});
