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

async function adminJson<T>(route: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl}${route}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-haina-role': 'admin',
      'x-haina-actor': 'demo-admin',
      ...(init?.headers ?? {}),
    },
  });
  return { status: response.status, body: (await response.json()) as T };
}

describe('active admin configuration APIs', () => {
  before(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'haina-active-admin-'));
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

  it('returns only active role and permission configuration', async () => {
    const response = await adminJson<{
      data: Record<string, unknown> & {
        permissionItems: Array<{ id: string; updatedAt: string }>;
        roles: Array<{ id: string }>;
        rolePermissionItems: Array<{ roleId: string }>;
      };
    }>('/api/admin/config');
    assert.equal(response.status, 200);
    assert.ok(response.body.data.roles.length > 0);
    assert.ok(response.body.data.permissionItems.length > 0);
    assert.ok(response.body.data.rolePermissionItems.length > 0);
    for (const removedKey of ['d1GuideConfig', 'weeklyFeedbackConfig', 'anonymousFeedbackConfig', 'anonymousFeedbacks']) {
      assert.equal(removedKey in response.body.data, false);
    }
  });

  it('persists permission edits and reloads them from the admin database', async () => {
    const before = await adminJson<{ data: { permissionItems: Array<{ id: string; updatedAt: string }> } }>('/api/admin/config');
    const current = before.body.data.permissionItems.find((item) => item.id === 'perm-chatgpt');
    assert.ok(current);

    const updated = await adminJson<{ data: { id: string; reasonTemplate: string; updatedBy: string } }>(
      '/api/admin/permission-items/perm-chatgpt',
      {
        method: 'PATCH',
        body: JSON.stringify({
          reasonTemplate: 'Phase 09 active permission reason.',
          expectedUpdatedAt: current.updatedAt,
        }),
      },
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.reasonTemplate, 'Phase 09 active permission reason.');
    assert.equal(updated.body.data.updatedBy, 'demo-admin');

    const reloaded = await adminJson<{ data: { permissionItems: Array<{ id: string; reasonTemplate: string }> } }>('/api/admin/config');
    assert.ok(
      reloaded.body.data.permissionItems.some(
        (item) => item.id === 'perm-chatgpt' && item.reasonTemplate === 'Phase 09 active permission reason.',
      ),
    );
  });

  it('keeps removed admin modules unavailable', async () => {
    for (const route of [
      '/api/admin/d1-guide-config',
      '/api/admin/weekly-feedback-analysis',
      '/api/admin/anonymous-feedbacks',
    ]) {
      const response = await adminJson<{ code: string }>(route);
      assert.equal(response.status, 404);
      assert.equal(response.body.code, 'NOT_FOUND');
    }
  });
});
