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
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  return { status: response.status, body: (await response.json()) as T };
}

describe('active newcomer permission APIs', () => {
  before(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'haina-active-permission-'));
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

  it('serves permission packages and persists submission progress', async () => {
    const packageResponse = await requestJson<{
      data: { requiredPermissions: Array<{ id: string }>; optionalPermissions: Array<{ id: string }> };
    }>('/api/roles/role-product-intern/permission-package');
    assert.equal(packageResponse.status, 200);
    assert.ok(packageResponse.body.data.requiredPermissions.some((item) => item.id === 'perm-oa'));

    const submitted = await requestJson<{
      data: { progress: { status: string }; followUpTask: { id: string; status: string } };
    }>('/api/newcomers/newcomer-yanyu/permission-progress', {
      method: 'POST',
      body: JSON.stringify({ permissionItemId: 'perm-chatgpt', status: 'submitted' }),
    });
    assert.equal(submitted.status, 201);
    assert.equal(submitted.body.data.progress.status, 'submitted');
    assert.equal(submitted.body.data.followUpTask.status, 'pending');

    const followUps = await requestJson<{ data: Array<{ permissionItemId: string; status: string }> }>(
      '/api/newcomers/newcomer-yanyu/follow-up-tasks',
    );
    assert.equal(followUps.status, 200);
    assert.ok(followUps.body.data.some((item) => item.permissionItemId === 'perm-chatgpt' && item.status === 'pending'));
  });

  it('keeps removed newcomer modules unavailable', async () => {
    for (const route of ['/api/d1-guide-config', '/api/weekly-feedback-config', '/api/anonymous-feedback-config']) {
      const response = await requestJson<{ code: string }>(route);
      assert.equal(response.status, 404);
      assert.equal(response.body.code, 'NOT_FOUND');
    }
    const d1Delivery = await requestJson<{ code: string }>('/api/newcomers/newcomer-yanyu/d1-guide-message', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(d1Delivery.status, 404);
  });
});

