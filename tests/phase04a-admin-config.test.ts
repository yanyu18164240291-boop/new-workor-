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
const nativeFetch = globalThis.fetch.bind(globalThis);

async function requestJson<T>(route: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await nativeFetch(`${baseUrl}${route}`, {
    headers: {
      'content-type': 'application/json',
      ...(route.startsWith('/api/admin/') || route.startsWith('/api/admin-config/')
        ? { 'x-haina-role': 'admin', 'x-haina-actor': 'demo-admin' }
        : {}),
      ...(init?.headers ?? {}),
    },
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
    assert.ok(roleColumns.some((column) => column.name === 'departmentId'));
    assert.ok(roleColumns.some((column) => column.name === 'enabled'));
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

    const beforePermission = await requestJson<{
      data: {
        permissionItems: Array<{ id: string; updatedAt: string }>;
      };
    }>('/api/admin/config');
    const chatgptBefore = beforePermission.body.data.permissionItems.find((item) => item.id === 'perm-chatgpt');
    assert.ok(chatgptBefore);

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
        permissionType: 'optional',
        ownerType: 'department',
        ownerName: 'Admin Owner',
        ownerContact: 'admin-owner@example.com',
        applyEntryName: 'ChatGPT Admin Access Form',
        applyUrl: 'https://applink.feishu.cn/T97PFtN6Wdeo',
        reasonTemplate: 'Apply because the role needs configured AI tools.',
        approverName: 'Admin Approver',
        commonWaitingReasons: ['Owner validating scope', 'License queue'],
        enabled: false,
        expectedUpdatedAt: chatgptBefore.updatedAt,
        updatedBy: 'malicious-admin',
      }),
    });
    assert.equal(permission.status, 200);
    assert.equal(permission.body.data.name, 'ChatGPT Admin Access');
    assert.equal(permission.body.data.permissionType, 'optional');
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

  it('rejects disabling a required permission that is bound to a role package', async () => {
    const admin = await requestJson<{ data: { permissionItems: Array<{ id: string; updatedAt: string }> } }>('/api/admin/config');
    const oa = admin.body.data.permissionItems.find((item) => item.id === 'perm-oa');
    assert.ok(oa);

    const disabled = await requestJson<{ error: string }>('/api/admin/permission-items/perm-oa', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false, expectedUpdatedAt: oa.updatedAt }),
    });

    assert.equal(disabled.status, 400);
    assert.match(disabled.body.error, /required permission/i);
  });

  it('rejects stale permission package updates with optimistic locking', async () => {
    const admin = await requestJson<{ data: { permissionItems: Array<{ id: string }> } }>('/api/admin/config');
    assert.ok(admin.body.data.permissionItems.some((item) => item.id === 'perm-bpm'));

    const stale = await requestJson<{ error: string; code: string }>('/api/admin/permission-items/perm-bpm', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Stale BPM update',
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      }),
    });

    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, 'CONFLICT');
    assert.match(stale.body.error, /stale/i);
  });

  it('creates a new role package role and reloads it from admin config', async () => {
    const created = await requestJson<{ data: { id: string; name: string; department: string; description: string; updatedBy: string } }>('/api/admin/roles', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Admin New Role',
        department: 'Admin New Department',
        description: 'Created from role package workbench.',
        updatedBy: 'demo-admin',
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.name, 'Admin New Role');
    assert.equal(created.body.data.updatedBy, 'demo-admin');

    const admin = await requestJson<{ data: { roles: Array<{ id: string; name: string; department: string }> } }>('/api/admin/config');
    assert.ok(admin.body.data.roles.some((role) => role.id === created.body.data.id && role.department === 'Admin New Department'));
  });

  it('creates a position through the admin-config contract and syncs it to role selectors and newcomer role data', async () => {
    const created = await requestJson<{
      data: { id: string; name: string; department: string; departmentId: string; description: string; updatedBy: string };
    }>('/api/admin-config/positions', {
      method: 'POST',
      body: JSON.stringify({
        name: '门店数字化运营实习生',
        departmentId: 'dept-store-digital',
        department: '门店数字化部',
        description: '负责门店数字化工具试点支持',
        updatedBy: 'malicious-admin',
      }),
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.departmentId, 'dept-store-digital');
    assert.equal(created.body.data.updatedBy, 'demo-admin');

    const admin = await requestJson<{ data: { roles: Array<{ id: string; name: string; departmentId: string }> } }>('/api/admin/config');
    assert.ok(admin.body.data.roles.some((role) => role.id === created.body.data.id && role.name === '门店数字化运营实习生'));

    const roles = await requestJson<{ data: Array<{ id: string; name: string }> }>('/api/roles');
    assert.ok(roles.body.data.some((role) => role.id === created.body.data.id));

    const packageResponse = await requestJson<{ data: { role: { id: string; name: string }; requiredPermissions: unknown[]; optionalPermissions: unknown[] } }>(
      `/api/roles/${created.body.data.id}/permission-package`,
    );
    assert.equal(packageResponse.status, 200);
    assert.equal(packageResponse.body.data.role.name, '门店数字化运营实习生');
    assert.deepEqual(packageResponse.body.data.requiredPermissions, []);
    assert.deepEqual(packageResponse.body.data.optionalPermissions, []);
  });

  it('rejects duplicate position names before writing admin role data', async () => {
    const duplicate = await requestJson<{ error: string; code: string }>('/api/admin-config/positions', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Admin configured role',
        departmentId: 'dept-collaboration-office',
        department: '协同办公部门',
        description: 'Duplicate should be blocked',
      }),
    });

    assert.equal(duplicate.status, 400);
    assert.equal(duplicate.body.code, 'VALIDATION_ERROR');
    assert.match(duplicate.body.error, /position name already exists|role name already exists/i);
  });

  it('soft-disables positions while keeping admin recovery and hiding them from newcomer role data', async () => {
    const created = await requestJson<{
      data: { id: string; name: string; enabled: boolean; updatedBy: string };
    }>('/api/admin-config/positions', {
      method: 'POST',
      body: JSON.stringify({
        name: `Soft Disabled Role ${Date.now()}`,
        departmentId: 'dept-soft-disabled',
        department: 'Soft Disable Department',
        description: 'Created to verify role soft delete guardrails.',
        updatedBy: 'malicious-admin',
      }),
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.enabled, true);
    assert.equal(created.body.data.updatedBy, 'demo-admin');

    const disabled = await requestJson<{ data: { id: string; enabled: boolean; updatedBy: string } }>(`/api/admin/roles/${created.body.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false, updatedBy: 'malicious-admin' }),
    });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.data.enabled, false);
    assert.equal(disabled.body.data.updatedBy, 'demo-admin');

    const admin = await requestJson<{ data: { roles: Array<{ id: string; enabled: boolean }> } }>('/api/admin/config');
    assert.ok(admin.body.data.roles.some((role) => role.id === created.body.data.id && role.enabled === false));

    const publicRoles = await requestJson<{ data: Array<{ id: string }> }>('/api/roles');
    assert.equal(publicRoles.body.data.some((role) => role.id === created.body.data.id), false);

    const hiddenPackage = await requestJson<{ error: string }>(`/api/roles/${created.body.data.id}/permission-package`);
    assert.equal(hiddenPackage.status, 404);

    const restored = await requestJson<{ data: { id: string; enabled: boolean } }>(`/api/admin/roles/${created.body.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.enabled, true);

    const restoredPublicRoles = await requestJson<{ data: Array<{ id: string }> }>('/api/roles');
    assert.ok(restoredPublicRoles.body.data.some((role) => role.id === created.body.data.id));
  });

  it('rejects unsafe admin permission writes before they can break downstream pages', async () => {
    const admin = await requestJson<{ data: { permissionItems: Array<{ id: string; updatedAt: string }> } }>('/api/admin/config');
    const oa = admin.body.data.permissionItems.find((item) => item.id === 'perm-oa');
    assert.ok(oa);

    const invalidUrl = await requestJson<{ error: string }>('/api/admin/permission-items/perm-oa', {
      method: 'PATCH',
      body: JSON.stringify({ applyUrl: 'not-a-url', expectedUpdatedAt: oa.updatedAt }),
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

    const emptyLink = await requestJson<{ error: string }>('/api/admin/d1-guide-config', {
      method: 'PATCH',
      body: JSON.stringify({
        items: [
          {
            actionKey: 'join_group',
            title: 'Enabled entry without link',
            description: 'Should be rejected before it reaches newcomer pages',
            targetGroupName: 'Configured newcomer group',
            applyUrl: '',
            resourceLinks: [],
            sendToEmployeeName: 'Configured HR',
            sendToEmployeeContact: 'hr@example.com',
            label: 'Join group',
            ownerName: 'HR Admin',
            enabled: true,
          },
        ],
      }),
    });
    assert.equal(emptyLink.status, 400);
    assert.match(emptyLink.body.error, /applyUrl/);

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
            applyUrl: 'https://applink.feishu.cn/client/chat/open?openChatId=oc_e558991e19bf2e476fbd51f4691f3bb4',
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

    const created = await requestJson<{
      data: { items: Array<{ actionKey: string; taskType: string; roleId: string; resourceLinks: Array<{ name: string; url: string; chatId: string }> }> };
    }>('/api/admin/d1-guide-config', {
      method: 'PATCH',
      body: JSON.stringify({
        items: [
          {
            actionKey: 'join_group_store_ops',
            taskType: 'join_group',
            organizationPath: '海底捞国际控股有限公司-集团总部-门店运营',
            departmentId: 'dept-store-ops',
            departmentName: '门店运营部',
            roleId: 'role-store-ops',
            roleName: '门店运营实习生',
            title: '加入门店运营新人群',
            description: '进入门店运营新人群完成 D1 对接。',
            targetGroupName: '门店运营新人群',
            resourceLinks: [{ name: '门店运营新人群', url: 'https://applink.feishu.cn/client/chat/open?openChatId=oc_store_ops', chatId: 'oc_store_ops' }],
            label: '加入新人群',
            ownerName: '门店运营 Owner',
            enabled: true,
          },
        ],
      }),
    });
    assert.equal(created.status, 200);
    assert.ok(created.body.data.items.some((item) => item.actionKey === 'join_group_store_ops' && item.resourceLinks[0].chatId === 'oc_store_ops'));
  });

  it('fills employee guide title from Feishu document metadata when the admin leaves it empty', async () => {
    const previousEnv = {
      appId: process.env.FEISHU_APP_ID,
      appSecret: process.env.FEISHU_APP_SECRET,
      redirectUri: process.env.FEISHU_REDIRECT_URI,
    };
    process.env.FEISHU_APP_ID = 'cli_test';
    process.env.FEISHU_APP_SECRET = 'test-secret';
    process.env.FEISHU_REDIRECT_URI = `${baseUrl}/api/auth/feishu/callback`;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/auth/v3/tenant_access_token/internal')) {
        return Response.json({ code: 0, msg: 'ok', tenant_access_token: 'tenant-token' });
      }
      if (url.includes('/drive/v1/metas/batch_query')) {
        const auth = init?.headers instanceof Headers ? init.headers.get('authorization') : (init?.headers as Record<string, string> | undefined)?.authorization;
        assert.equal(auth, 'Bearer tenant-token');
        return Response.json({ code: 0, msg: 'ok', data: { metas: [{ title: '真实员工指南册标题' }] } });
      }
      return nativeFetch(input, init);
    }) as typeof fetch;

    try {
      const saved = await requestJson<{ data: { employeeGuide: { documentTitle: string; documentUrl: string } } }>('/api/admin/d1-guide-config', {
        method: 'PATCH',
        body: JSON.stringify({
          items: [
            {
              actionKey: 'employee_guide',
              taskType: 'employee_guide',
              title: '查看员工指南册',
              description: '查看真实飞书员工指南册。',
              documentTitle: '',
              documentUrl: 'https://haidilao.feishu.cn/docx/YB37dnzemobXxMxGiuycsFHvnlv',
              label: '查看指南册',
              ownerName: 'Content Admin',
              enabled: true,
            },
          ],
        }),
      });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.data.employeeGuide.documentTitle, '真实员工指南册标题');
    } finally {
      globalThis.fetch = nativeFetch;
      if (previousEnv.appId === undefined) delete process.env.FEISHU_APP_ID;
      else process.env.FEISHU_APP_ID = previousEnv.appId;
      if (previousEnv.appSecret === undefined) delete process.env.FEISHU_APP_SECRET;
      else process.env.FEISHU_APP_SECRET = previousEnv.appSecret;
      if (previousEnv.redirectUri === undefined) delete process.env.FEISHU_REDIRECT_URI;
      else process.env.FEISHU_REDIRECT_URI = previousEnv.redirectUri;
    }
  });

  it('keeps disabled D1 guide items editable in admin while hiding them from newcomer pages', async () => {
    const disabled = await requestJson<{
      data: { permissionPackage: { actionKey: string; label: string; enabled: boolean; updatedBy: string } };
    }>('/api/admin/d1-guide-config', {
      method: 'PATCH',
      body: JSON.stringify({
        updatedBy: 'demo-admin',
        items: [
          {
            actionKey: 'permission_package',
            title: 'Temporarily disabled package',
            description: 'Admin can still edit this fixed D1 item',
            routePath: '/permissions',
            label: 'Hidden from newcomer',
            ownerName: 'Permission Admin',
            enabled: false,
          },
        ],
      }),
    });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.data.permissionPackage.actionKey, 'permission_package');
    assert.equal(disabled.body.data.permissionPackage.enabled, false);
    assert.equal(disabled.body.data.permissionPackage.updatedBy, 'demo-admin');

    const adminReloaded = await requestJson<{
      data: { d1GuideConfig: { permissionPackage: { label: string; enabled: boolean } } };
    }>('/api/admin/config');
    assert.equal(adminReloaded.body.data.d1GuideConfig.permissionPackage.label, 'Hidden from newcomer');
    assert.equal(adminReloaded.body.data.d1GuideConfig.permissionPackage.enabled, false);

    const newcomerReloaded = await requestJson<{ data: { permissionPackage: null | { label: string } } }>('/api/d1-guide-config');
    assert.equal(newcomerReloaded.body.data.permissionPackage, null);

    const restored = await requestJson<{ data: { permissionPackage: { enabled: boolean } } }>('/api/admin/d1-guide-config', {
      method: 'PATCH',
      body: JSON.stringify({
        items: [
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
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.permissionPackage.enabled, true);
  });

  it('keeps all three fixed D1 guide rows in admin when non-route entries are disabled', async () => {
    const disabled = await requestJson<{
      data: {
        joinGroup: { actionKey: string; enabled: boolean };
        employeeGuide: { actionKey: string; enabled: boolean };
        permissionPackage: { actionKey: string; enabled: boolean };
      };
    }>('/api/admin/d1-guide-config', {
      method: 'PATCH',
      body: JSON.stringify({
        items: [
          { actionKey: 'join_group', title: 'Join configured group', description: 'Disabled by admin', label: 'Join group', ownerName: 'HR Admin', enabled: false },
          {
            actionKey: 'employee_guide',
            title: 'Read configured guide',
            description: 'Disabled by admin',
            label: 'Read guide',
            ownerName: 'Content Admin',
            enabled: false,
          },
        ],
      }),
    });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.data.joinGroup.enabled, false);
    assert.equal(disabled.body.data.employeeGuide.enabled, false);
    assert.equal(disabled.body.data.permissionPackage.actionKey, 'permission_package');

    const adminReloaded = await requestJson<{
      data: {
        d1GuideConfig: {
          joinGroup: { actionKey: string; enabled: boolean };
          employeeGuide: { actionKey: string; enabled: boolean };
          permissionPackage: { actionKey: string; enabled: boolean };
        };
      };
    }>('/api/admin/config');
    assert.equal(adminReloaded.body.data.d1GuideConfig.joinGroup.actionKey, 'join_group');
    assert.equal(adminReloaded.body.data.d1GuideConfig.joinGroup.enabled, false);
    assert.equal(adminReloaded.body.data.d1GuideConfig.employeeGuide.actionKey, 'employee_guide');
    assert.equal(adminReloaded.body.data.d1GuideConfig.employeeGuide.enabled, false);
    assert.equal(adminReloaded.body.data.d1GuideConfig.permissionPackage.actionKey, 'permission_package');

    const newcomer = await requestJson<{
      data: {
        joinGroup: null | { actionKey: string };
        employeeGuide: null | { actionKey: string };
        permissionPackage: null | { actionKey: string };
      };
    }>('/api/d1-guide-config');
    assert.equal(newcomer.body.data.joinGroup, null);
    assert.equal(newcomer.body.data.employeeGuide, null);
    assert.equal(newcomer.body.data.permissionPackage?.actionKey, 'permission_package');
  });

  it('serves a dedicated admin D1 guide config endpoint with all fixed rows', async () => {
    const adminD1 = await requestJson<{
      data: {
        joinGroup: { actionKey: string; enabled: boolean };
        employeeGuide: { actionKey: string; enabled: boolean };
        permissionPackage: { actionKey: string; title: string; label: string; enabled: boolean };
      };
    }>('/api/admin/d1-guide-config');
    assert.equal(adminD1.status, 200);
    assert.equal(adminD1.body.data.joinGroup.actionKey, 'join_group');
    assert.equal(adminD1.body.data.employeeGuide.actionKey, 'employee_guide');
    assert.equal(adminD1.body.data.permissionPackage.actionKey, 'permission_package');
    assert.equal(typeof adminD1.body.data.permissionPackage.title, 'string');
    assert.equal(typeof adminD1.body.data.permissionPackage.label, 'string');
  });

  it('validates D1 guide route and external link fields before saving', async () => {
    const unsafeRoute = await requestJson<{ error: string }>('/api/admin/d1-guide-config', {
      method: 'PATCH',
      body: JSON.stringify({
        items: [
          {
            actionKey: 'permission_package',
            title: 'Unsafe route',
            description: 'Should be rejected',
            routePath: '/admin/workbench',
            label: 'Open unsafe route',
            ownerName: 'Permission Admin',
            enabled: true,
          },
        ],
      }),
    });
    assert.equal(unsafeRoute.status, 400);
    assert.match(unsafeRoute.body.error, /routePath/);

    const unsafeLink = await requestJson<{ error: string }>('/api/admin/d1-guide-config', {
      method: 'PATCH',
      body: JSON.stringify({
        items: [
          {
            actionKey: 'employee_guide',
            title: 'Unsafe guide link',
            description: 'Should be rejected',
            documentTitle: 'Guide',
            documentUrl: 'not-a-url',
            label: 'Read guide',
            ownerName: 'Content Admin',
            enabled: true,
          },
        ],
      }),
    });
    assert.equal(unsafeLink.status, 400);
    assert.match(unsafeLink.body.error, /documentUrl/);
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

  it('persists edited weekly feedback option labels and newly added options for newcomer rendering', async () => {
    const admin = await requestJson<{
      data: { weeklyFeedbackConfig: { questions: Array<{ id: string; inputType: string; options: Array<{ id: string; label: string; enabled: boolean; sortOrder: number }> }> } };
    }>('/api/admin/config');
    const choice = admin.body.data.weeklyFeedbackConfig.questions.find((question) => question.inputType === 'single' && question.options.length > 0);
    assert.ok(choice);
    const firstOption = choice.options[0];
    const newOptionLabel = `后台新增选项 ${Date.now()}`;

    const saved = await requestJson<{
      data: { questions: Array<{ id: string; options: Array<{ id: string; label: string; enabled: boolean; sortOrder: number }> }> };
    }>('/api/admin/weekly-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        questions: [
          {
            id: choice.id,
            title: '首周整体感受',
            enabled: true,
            options: [
              { id: firstOption.id, label: '后台改名选项', enabled: true, sortOrder: 1 },
              { label: newOptionLabel, enabled: true, sortOrder: 9 },
            ],
          },
        ],
      }),
    });

    assert.equal(saved.status, 200);
    const savedQuestion = saved.body.data.questions.find((question) => question.id === choice.id);
    assert.ok(savedQuestion?.options.some((option) => option.label === '后台改名选项' && option.sortOrder === 1));
    assert.ok(savedQuestion?.options.some((option) => option.label === newOptionLabel && option.enabled));

    const newcomer = await requestJson<{ data: { questions: Array<{ id: string; options: Array<{ label: string }> }> } }>('/api/weekly-feedback-config');
    const newcomerQuestion = newcomer.body.data.questions.find((question) => question.id === choice.id);
    assert.ok(newcomerQuestion?.options.some((option) => option.label === newOptionLabel));
  });

  it('returns admin weekly feedback config with disabled questions while newcomer config stays enabled-only', async () => {
    const admin = await requestJson<{
      data: { weeklyFeedbackConfig: { questions: Array<{ id: string; title: string; enabled: boolean }> } };
    }>('/api/admin/config');
    const target = admin.body.data.weeklyFeedbackConfig.questions.find((question) => question.enabled);
    assert.ok(target);

    const disabled = await requestJson<{
      data: { questions: Array<{ id: string; title: string; enabled: boolean; updatedBy: string }> };
    }>('/api/admin/weekly-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        updatedBy: 'demo-admin',
        questions: [{ id: target.id, title: 'Disabled but editable weekly question', enabled: false }],
      }),
    });
    assert.equal(disabled.status, 200);
    assert.ok(disabled.body.data.questions.some((question) => question.id === target.id && question.enabled === false && question.updatedBy === 'demo-admin'));

    const newcomer = await requestJson<{ data: { questions: Array<{ id: string }> } }>('/api/weekly-feedback-config');
    assert.equal(newcomer.body.data.questions.some((question) => question.id === target.id), false);

    const restored = await requestJson<{ data: { questions: Array<{ id: string; enabled: boolean }> } }>('/api/admin/weekly-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        questions: [{ id: target.id, title: target.title, enabled: true }],
      }),
    });
    assert.equal(restored.status, 200);
    assert.ok(restored.body.data.questions.some((question) => question.id === target.id && question.enabled === true));
  });

  it('persists weekly feedback question order for newcomer rendering', async () => {
    const admin = await requestJson<{
      data: { weeklyFeedbackConfig: { questions: Array<{ id: string; enabled: boolean; sortOrder: number }> } };
    }>('/api/admin/config');
    const enabled = admin.body.data.weeklyFeedbackConfig.questions.filter((question) => question.enabled);
    assert.ok(enabled.length >= 2);
    const first = enabled[0];
    const last = enabled[enabled.length - 1];

    const reordered = await requestJson<{ data: { questions: Array<{ id: string; enabled: boolean; sortOrder: number }> } }>('/api/admin/weekly-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        updatedBy: 'demo-admin',
        questions: [
          { id: last.id, sortOrder: 1 },
          { id: first.id, sortOrder: 2 },
        ],
      }),
    });

    assert.equal(reordered.status, 200);
    const adminEnabledOrder = reordered.body.data.questions.filter((question) => question.enabled).map((question) => question.id);
    assert.equal(adminEnabledOrder[0], last.id);
    assert.equal(adminEnabledOrder[1], first.id);
    const sortOrders = reordered.body.data.questions.map((question) => question.sortOrder);
    assert.deepEqual(sortOrders, [...sortOrders].sort((left, right) => left - right));
    assert.equal(new Set(sortOrders).size, sortOrders.length);

    const newcomer = await requestJson<{ data: { questions: Array<{ id: string }> } }>('/api/weekly-feedback-config');
    assert.equal(newcomer.body.data.questions[0].id, last.id);
    assert.equal(newcomer.body.data.questions[1].id, first.id);
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

  it('persists new anonymous feedback child options under the selected module for newcomer linkage', async () => {
    const suffix = Date.now();
    const problemLabel = `后台D1问题类型${suffix}`;
    const actionLabel = `后台D1处理方式${suffix}`;

    const saved = await requestJson<{
      data: {
        modules: Array<{
          id: string;
          problemTypes: Array<{ id: string; label: string; typeKey: string }>;
          expectedActions: Array<{ id: string; label: string; actionKey: string }>;
        }>;
      };
    }>('/api/admin/anonymous-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        problemTypes: [
          {
            id: `afpt-admin-d1-${suffix}`,
            moduleId: 'afm-d1-guide',
            typeKey: `admin_d1_type_${suffix}`,
            label: problemLabel,
            enabled: true,
            sortOrder: 88,
          },
        ],
        expectedActions: [
          {
            id: `afea-admin-d1-${suffix}`,
            moduleId: 'afm-d1-guide',
            actionKey: `admin_d1_action_${suffix}`,
            label: actionLabel,
            enabled: true,
            sortOrder: 88,
          },
        ],
      }),
    });

    assert.equal(saved.status, 200);
    const d1 = saved.body.data.modules.find((module) => module.id === 'afm-d1-guide');
    const permission = saved.body.data.modules.find((module) => module.id === 'afm-permission');
    assert.ok(d1?.problemTypes.some((item) => item.label === problemLabel));
    assert.ok(d1?.expectedActions.some((item) => item.label === actionLabel));
    assert.equal(permission?.problemTypes.some((item) => item.label === problemLabel), false);
    assert.equal(permission?.expectedActions.some((item) => item.label === actionLabel), false);

    const newcomer = await requestJson<{
      data: {
        modules: Array<{
          id: string;
          problemTypes: Array<{ label: string }>;
          expectedActions: Array<{ label: string }>;
        }>;
      };
    }>('/api/anonymous-feedback-config');
    const newcomerD1 = newcomer.body.data.modules.find((module) => module.id === 'afm-d1-guide');
    assert.ok(newcomerD1?.problemTypes.some((item) => item.label === problemLabel));
    assert.ok(newcomerD1?.expectedActions.some((item) => item.label === actionLabel));
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

  it('returns admin anonymous config with disabled modules while newcomer config stays enabled-only', async () => {
    const disabled = await requestJson<{
      data: { modules: Array<{ id: string; label: string; enabled: boolean; updatedBy: string }> };
    }>('/api/admin/anonymous-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        updatedBy: 'demo-admin',
        modules: [{ id: 'afm-permission', label: 'Disabled but editable permission feedback', enabled: false }],
      }),
    });
    assert.equal(disabled.status, 200);
    assert.ok(
      disabled.body.data.modules.some(
        (module) => module.id === 'afm-permission' && module.enabled === false && module.updatedBy === 'demo-admin',
      ),
    );

    const adminReloaded = await requestJson<{ data: { anonymousFeedbackConfig: { modules: Array<{ id: string; enabled: boolean }> } } }>(
      '/api/admin/config',
    );
    assert.ok(adminReloaded.body.data.anonymousFeedbackConfig.modules.some((module) => module.id === 'afm-permission' && module.enabled === false));

    const newcomer = await requestJson<{ data: { modules: Array<{ id: string }> } }>('/api/anonymous-feedback-config');
    assert.equal(newcomer.body.data.modules.some((module) => module.id === 'afm-permission'), false);

    const restored = await requestJson<{ data: { modules: Array<{ id: string; enabled: boolean }> } }>('/api/admin/anonymous-feedback-config', {
      method: 'PATCH',
      body: JSON.stringify({
        modules: [{ id: 'afm-permission', label: 'Configured permission feedback', enabled: true }],
      }),
    });
    assert.equal(restored.status, 200);
    assert.ok(restored.body.data.modules.some((module) => module.id === 'afm-permission' && module.enabled === true));
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

  it('creates knowledge base metadata with simulated parse and vector states', async () => {
    const created = await requestJson<{
      data: {
        id: string;
        title: string;
        sourceUrl: string;
        applicableRoleId: string;
        fileSize: number;
        fileHash: string;
        filePath: string;
        status: string;
        parseStatus: string;
        vectorStatus: string;
        updatedBy: string;
      };
    }>('/api/admin/knowledge-base-docs', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Admin uploaded metadata only',
        category: '入职知识',
        applicableRoleId: 'role-product-intern',
        applicableRole: '协同办公产品实习生',
        applicableStage: 'D1',
        ownerName: 'Knowledge Owner',
        sourceUrl: 'mock-drive://admin-upload',
        status: 'enabled',
        parseStatus: 'parsed',
        vectorStatus: 'ready',
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.title, 'Admin uploaded metadata only');
    assert.equal(created.body.data.applicableRoleId, 'role-product-intern');
    assert.equal(created.body.data.fileSize, 0);
    assert.equal(created.body.data.fileHash, 'mock-md5-pending');
    assert.equal(created.body.data.filePath, 'mock-file://selected-admin-doc.pdf');
    assert.equal(created.body.data.status, 'disabled');
    assert.equal(created.body.data.parseStatus, 'pending');
    assert.equal(created.body.data.vectorStatus, 'pending');
    assert.equal(created.body.data.updatedBy, 'demo-admin');
  });

  it('guards knowledge metadata categories, role references, and mock parse state transitions', async () => {
    const badCategory = await requestJson<{ error: string }>('/api/admin/knowledge-base-docs', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Bad category',
        category: '入职知识错别字',
        applicableRoleId: 'role-product-intern',
        applicableRole: '协同办公产品实习生',
        applicableStage: 'D1',
        ownerName: 'Knowledge Owner',
        sourceUrl: 'mock-drive://bad-category',
      }),
    });
    assert.equal(badCategory.status, 400);
    assert.match(badCategory.body.error, /category/);

    const badRole = await requestJson<{ error: string }>('/api/admin/knowledge-base-docs', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Bad role',
        category: '入职知识',
        applicableRoleId: 'role-missing',
        applicableRole: '不存在岗位',
        applicableStage: 'D1',
        ownerName: 'Knowledge Owner',
        sourceUrl: 'mock-drive://bad-role',
      }),
    });
    assert.equal(badRole.status, 400);
    assert.match(badRole.body.error, /applicableRoleId/);

    const created = await requestJson<{ data: { id: string; status: string; parseStatus: string; vectorStatus: string } }>('/api/admin/knowledge-base-docs', {
      method: 'POST',
      body: JSON.stringify({
        title: 'State machine metadata',
        category: '系统权限',
        applicableRoleId: 'role-product-intern',
        applicableRole: '协同办公产品实习生',
        applicableStage: 'D1',
        ownerName: 'Knowledge Owner',
        sourceUrl: 'mock-drive://state-machine',
      }),
    });
    assert.equal(created.body.data.status, 'disabled');

    const blocked = await requestJson<{ error: string }>(`/api/admin-config/knowledge/${created.body.data.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'enabled' }),
    });
    assert.equal(blocked.status, 400);
    assert.match(blocked.body.error, /parsed/);

    const parsed = await requestJson<{ data: { id: string; status: string; parseStatus: string; vectorStatus: string } }>(
      `/api/admin-config/knowledge/${created.body.data.id}/trigger-mock-parse`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    assert.equal(parsed.status, 200);
    assert.equal(parsed.body.data.status, 'disabled');
    assert.equal(parsed.body.data.parseStatus, 'parsed');
    assert.equal(parsed.body.data.vectorStatus, 'ready');

    const enabled = await requestJson<{ data: { id: string; status: string } }>(`/api/admin-config/knowledge/${created.body.data.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'enabled' }),
    });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.data.status, 'enabled');
  });
});
