import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { createApiServer } from '../src/server/app.ts';
import { createDatabase } from '../src/server/db.ts';
import { runMigrations } from '../src/server/migrations.ts';
import { seedDatabase } from '../src/server/seed.ts';

let baseUrl = '';
let closeServer: () => Promise<void>;
let tempDir = '';

async function requestJson<T>(route: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  return {
    status: response.status,
    body: (await response.json()) as T,
  };
}

describe('Phase 04A writable admin configuration', () => {
  before(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'haina-admin-'));
    const db = createDatabase(path.join(tempDir, 'test.db'));
    runMigrations(db);
    seedDatabase(db);
    const server = await createApiServer({ db, port: 0 });
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });

  after(async () => {
    await closeServer?.();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('upgrades legacy admin tables with audit columns during migration', async () => {
    const legacyDir = await mkdtemp(path.join(tmpdir(), 'haina-admin-legacy-'));
    const legacyDb = createDatabase(path.join(legacyDir, 'legacy.db'));
    legacyDb.exec("CREATE TABLE roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, department TEXT NOT NULL, description TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);");
    legacyDb.exec("CREATE TABLE anonymous_feedbacks (id TEXT PRIMARY KEY, updatedAt TEXT NOT NULL);");

    runMigrations(legacyDb);

    const roleColumns = legacyDb.prepare('PRAGMA table_info(roles)').all() as Array<{ name: string }>;
    const feedbackColumns = legacyDb.prepare('PRAGMA table_info(anonymous_feedbacks)').all() as Array<{ name: string }>;
    assert.ok(roleColumns.some((column) => column.name === 'updatedBy'));
    assert.ok(feedbackColumns.some((column) => column.name === 'handlerName'));
    assert.ok(feedbackColumns.some((column) => column.name === 'handledAt'));
    assert.ok(feedbackColumns.some((column) => column.name === 'resolutionNote'));

    legacyDb.close();
    await rm(legacyDir, { recursive: true, force: true });
  });

  it('updates role and permission package fields without deleting historical rows', async () => {
    const role = await requestJson<{ data: { id: string; name: string; description: string; updatedBy: string } }>('/api/admin/roles/role-product-intern', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Admin configured role',
        department: 'Admin configured department',
        description: 'Configured through /admin-config',
      }),
    });
    assert.equal(role.status, 200);
    assert.equal(role.body.data.name, 'Admin configured role');
    assert.equal(role.body.data.updatedBy, 'demo-admin');

    const permission = await requestJson<{
      data: {
        id: string;
        name: string;
        permissionType: string;
        ownerType: string;
        ownerName: string;
        applyEntryName: string;
        applyUrl: string;
        reasonTemplate: string;
        commonWaitingReasons: string[];
        enabled: boolean;
        updatedBy: string;
      };
    }>('/api/admin/permission-items/perm-chatgpt', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'ChatGPT Admin Access',
        category: 'AI tools',
        permissionType: 'required',
        ownerType: 'department',
        ownerName: 'Admin Owner',
        ownerContact: 'admin-owner@example.com',
        applyEntryName: 'ChatGPT Admin Access Form',
        applyUrl: 'mock-feishu://approval/chatgpt-admin',
        reasonTemplate: 'Apply because the role needs configured AI tools.',
        approverName: 'Admin Approver',
        commonWaitingReasons: ['Owner validating scope', 'License queue'],
        enabled: false,
      }),
    });
    assert.equal(permission.status, 200);
    assert.equal(permission.body.data.name, 'ChatGPT Admin Access');
    assert.equal(permission.body.data.permissionType, 'required');
    assert.equal(permission.body.data.ownerType, 'department');
    assert.equal(permission.body.data.ownerName, 'Admin Owner');
    assert.equal(permission.body.data.applyEntryName, 'ChatGPT Admin Access Form');
    assert.deepEqual(permission.body.data.commonWaitingReasons, ['Owner validating scope', 'License queue']);
    assert.equal(permission.body.data.enabled, false);
    assert.equal(permission.body.data.updatedBy, 'demo-admin');

    const admin = await requestJson<{
      data: {
        roles: Array<{ id: string; name: string }>;
        permissionItems: Array<{ id: string; name: string; ownerType: string; applyEntryName: string; enabled: boolean }>;
      };
    }>('/api/admin/config');
    assert.equal(admin.status, 200);
    assert.ok(admin.body.data.roles.some((item) => item.id === 'role-product-intern' && item.name === 'Admin configured role'));
    assert.ok(
      admin.body.data.permissionItems.some(
        (item) =>
          item.id === 'perm-chatgpt' &&
          item.name === 'ChatGPT Admin Access' &&
          item.ownerType === 'department' &&
          item.applyEntryName === 'ChatGPT Admin Access Form' &&
          item.enabled === false,
      ),
    );

    const progress = await requestJson<{ data: Array<{ permissionItemId: string }> }>('/api/newcomers/newcomer-yanyu/permission-progress');
    assert.equal(progress.status, 200);
    assert.ok(progress.body.data.some((item) => item.permissionItemId === 'perm-oa'));
  });

  it('rejects unsafe admin permission writes before they can break downstream pages', async () => {
    const invalidUrl = await requestJson<{ error: string }>('/api/admin/permission-items/perm-oa', {
      method: 'PATCH',
      body: JSON.stringify({ applyUrl: 'not-a-url' }),
    });
    assert.equal(invalidUrl.status, 400);
    assert.match(invalidUrl.body.error, /applyUrl/);

    const duplicate = await requestJson<{ error: string }>('/api/admin/role-permission-items', {
      method: 'POST',
      body: JSON.stringify({ roleId: 'role-product-intern', permissionItemId: 'perm-oa' }),
    });
    assert.equal(duplicate.status, 400);
    assert.match(duplicate.body.error, /duplicate/);
  });

  it('persists D1 guide configuration and rejects invalid permission package routes', async () => {
    const invalid = await requestJson<{ error: string }>('/api/admin/d1-guide-config', {
      method: 'PATCH',
      body: JSON.stringify({
        items: [
          {
            actionKey: 'permission_package',
            title: 'Broken route',
            description: 'Should be rejected',
            label: 'Broken',
            ownerName: 'Admin',
            routePath: '/missing',
            enabled: true,
          },
        ],
      }),
    });
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /routePath/);

    const saved = await requestJson<{
      data: { joinGroup: { targetGroupName: string; applyUrl: string; updatedBy: string }; permissionPackage: { routePath: string; label: string } };
    }>('/api/admin/d1-guide-config', {
      method: 'PATCH',
      body: JSON.stringify({
        items: [
          {
            actionKey: 'join_group',
            title: 'Join configured group',
            description: 'D1 group configured by admin',
            targetGroupName: 'Configured newcomer group',
            applyUrl: 'mock-feishu://chat/configured',
            sendToEmployeeName: 'Configured HR',
            sendToEmployeeContact: 'hr@example.com',
            label: 'Join group',
            ownerName: 'HR Admin',
            enabled: true,
          },
          {
            actionKey: 'permission_package',
            title: 'Open configured package',
            description: 'Configured permission package entry',
            routePath: '/permissions',
            label: 'Open permissions',
            ownerName: 'Permission Admin',
            enabled: true,
          },
        ],
      }),
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.data.joinGroup.targetGroupName, 'Configured newcomer group');
    assert.equal(saved.body.data.joinGroup.updatedBy, 'demo-admin');
    assert.equal(saved.body.data.permissionPackage.label, 'Open permissions');

    const reloaded = await requestJson<{ data: { joinGroup: { targetGroupName: string }; permissionPackage: { label: string } } }>(
      '/api/d1-guide-config',
    );
    assert.equal(reloaded.body.data.joinGroup.targetGroupName, 'Configured newcomer group');
    assert.equal(reloaded.body.data.permissionPackage.label, 'Open permissions');
  });

  it('rejects weekly feedback config that would leave newcomers with no enabled questions', async () => {
    const config = await requestJson<{ data: { questions: Array<{ id: string }> } }>('/api/weekly-feedback-config');
    const disabled = await requestJson<{ error: string }>('/api/admin/weekly-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        questions: config.body.data.questions.map((question) => ({ id: question.id, title: `Disabled ${question.id}`, enabled: false })),
      }),
    });

    assert.equal(disabled.status, 400);
    assert.match(disabled.body.error, /weekly feedback/i);
  });

  it('keeps weekly feedback choice questions with at least one enabled option', async () => {
    const admin = await requestJson<{
      data: { weeklyFeedbackConfig: { questions: Array<{ id: string; inputType: string; options: Array<{ id: string; enabled: boolean }> }> } };
    }>('/api/admin/config');
    const choice = admin.body.data.weeklyFeedbackConfig.questions.find((question) => question.inputType !== 'text' && question.options.length > 0);
    assert.ok(choice);

    const disabledOptions = await requestJson<{ error: string }>('/api/admin/weekly-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        questions: [
          {
            id: choice.id,
            title: 'Choice question still needs one option',
            enabled: true,
            options: choice.options.map((option) => ({ id: option.id, label: option.id, enabled: false })),
          },
        ],
      }),
    });

    assert.equal(disabledOptions.status, 400);
    assert.match(disabledOptions.body.error, /enabled option/i);
  });

  it('persists editable anonymous feedback classification config and validates references', async () => {
    const invalid = await requestJson<{ error: string }>('/api/admin/anonymous-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        problemTypes: [{ id: 'missing', moduleId: 'missing-module', label: 'Invalid', enabled: true }],
      }),
    });
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /module/);

    const saved = await requestJson<{
      data: {
        modules: Array<{
          id: string;
          moduleKey: string;
          label: string;
          problemTypes: Array<{ id: string; label: string; enabled: boolean; updatedBy: string }>;
          expectedActions: Array<{ id: string; label: string; enabled: boolean }>;
        }>;
      };
    }>('/api/admin/anonymous-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        modules: [{ id: 'afm-permission', label: 'Configured permission feedback', enabled: true }],
        problemTypes: [{ id: 'afpt-permission-entry_missing', label: 'Configured missing entry', enabled: true }],
        expectedActions: [{ id: 'afea-permission-add_entry', label: 'Configured add entry', enabled: true }],
      }),
    });
    assert.equal(saved.status, 200);
    const permission = saved.body.data.modules.find((item) => item.id === 'afm-permission');
    assert.equal(permission?.label, 'Configured permission feedback');
    assert.ok(
      permission?.problemTypes.some(
        (item) => item.id === 'afpt-permission-entry_missing' && item.label === 'Configured missing entry' && item.updatedBy === 'demo-admin',
      ),
    );
    assert.ok(permission?.expectedActions.some((item) => item.id === 'afea-permission-add_entry' && item.label === 'Configured add entry'));

    const reloaded = await requestJson<{ data: { modules: Array<{ id: string; label: string }> } }>('/api/anonymous-feedback-config');
    assert.ok(reloaded.body.data.modules.some((item) => item.id === 'afm-permission' && item.label === 'Configured permission feedback'));
  });

  it('rejects duplicate anonymous feedback typeKey and actionKey in the same module', async () => {
    const duplicateType = await requestJson<{ error: string }>('/api/admin/anonymous-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        problemTypes: [
          {
            id: 'afpt-duplicate-type',
            moduleId: 'afm-permission',
            typeKey: 'entry_missing',
            label: 'Duplicate type key',
            enabled: true,
          },
        ],
      }),
    });
    assert.equal(duplicateType.status, 400);
    assert.match(duplicateType.body.error, /typeKey/);

    const duplicateAction = await requestJson<{ error: string }>('/api/admin/anonymous-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        expectedActions: [
          {
            id: 'afea-duplicate-action',
            moduleId: 'afm-permission',
            actionKey: 'add_entry',
            label: 'Duplicate action key',
            enabled: true,
          },
        ],
      }),
    });
    assert.equal(duplicateAction.status, 400);
    assert.match(duplicateAction.body.error, /actionKey/);
  });

  it('updates anonymous feedback pool status, conclusion, and review inclusion', async () => {
    const updated = await requestJson<{
      data: {
        id: string;
        status: string;
        result: string;
        includedInReview: boolean;
        ownerName: string;
        handlerName: string;
        resolutionNote: string;
        handledAt: string;
        updatedBy: string;
      };
    }>('/api/admin/anonymous-feedbacks/anon-001', {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'knowledge_added',
        result: 'Added waiting reason content to the knowledge base.',
        ownerName: 'Feedback Owner',
        handlerName: 'demo-admin',
        resolutionNote: 'Knowledge owner updated the source package.',
        includedInReview: false,
      }),
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.status, 'knowledge_added');
    assert.equal(updated.body.data.result, 'Added waiting reason content to the knowledge base.');
    assert.equal(updated.body.data.ownerName, 'Feedback Owner');
    assert.equal(updated.body.data.handlerName, 'demo-admin');
    assert.equal(updated.body.data.resolutionNote, 'Knowledge owner updated the source package.');
    assert.match(updated.body.data.handledAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(updated.body.data.updatedBy, 'demo-admin');
    assert.equal(updated.body.data.includedInReview, false);

    const pool = await requestJson<{ data: Array<{ id: string; status: string; result: string; includedInReview: boolean }> }>(
      '/api/admin/anonymous-feedbacks',
    );
    const reloaded = pool.body.data.find((item) => item.id === 'anon-001');
    assert.equal(reloaded?.status, 'knowledge_added');
    assert.equal(reloaded?.includedInReview, false);
  });
});
