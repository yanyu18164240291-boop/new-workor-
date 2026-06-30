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

async function requestJson(route: string, init?: RequestInit): Promise<{ status: number; body: { error: string; code: string } }> {
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
    body: (await response.json()) as { error: string; code: string },
  };
}

describe('backend error responses', () => {
  before(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'haina-errors-'));
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

  it('returns a stable validation error shape for bad request bodies', async () => {
    const response = await requestJson('/api/newcomers/newcomer-yanyu/permission-progress', {
      method: 'POST',
      body: JSON.stringify({ permissionItemId: 'perm-oa', status: 'waiting' }),
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.equal(response.body.error, 'status is invalid');
  });

  it('returns stable not-found errors for missing API routes', async () => {
    const response = await requestJson('/api/missing-route');

    assert.equal(response.status, 404);
    assert.equal(response.body.code, 'NOT_FOUND');
    assert.equal(response.body.error, 'Route not found');
  });

  it('returns stable invalid-json errors for malformed JSON bodies', async () => {
    const response = await requestJson('/api/anonymous-feedbacks', {
      method: 'POST',
      body: '{bad json',
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_JSON');
    assert.equal(response.body.error, 'Invalid JSON body');
  });

  it('rejects admin API requests without the demo admin role guard', async () => {
    const response = await nativeFetch(`${baseUrl}/api/admin/config`);
    const body = (await response.json()) as { error: string; code: string };

    assert.equal(response.status, 403);
    assert.equal(body.code, 'FORBIDDEN');
    assert.match(body.error, /admin/i);
  });

  it('rejects admin-config API requests without the demo admin role guard', async () => {
    const response = await nativeFetch(`${baseUrl}/api/admin-config/positions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Unauthorized Position',
        departmentId: 'dept-unauthorized',
        department: 'Unauthorized',
        description: 'Should not be written',
      }),
    });
    const body = (await response.json()) as { error: string; code: string };

    assert.equal(response.status, 403);
    assert.equal(body.code, 'FORBIDDEN');
    assert.match(body.error, /admin/i);
  });

  it('returns JSON 500 errors when SQLite writes fail', async () => {
    const lockedDir = await mkdtemp(path.join(tmpdir(), 'haina-closed-db-'));
    const db = createDatabase(path.join(lockedDir, 'closed.db'));
    runMigrations(db);
    seedDatabase(db);
    const server = await createApiServer({ db, port: 0 });
    db.close();

    try {
      const response = await nativeFetch(`${server.baseUrl}/api/admin/knowledge-base-docs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-haina-role': 'admin', 'x-haina-actor': 'demo-admin' },
        body: JSON.stringify({
          title: 'Closed database write',
          category: '入职知识',
          applicableRoleId: 'role-product-intern',
          applicableRole: '协同办公产品实习生',
          applicableStage: 'D1',
          ownerName: 'Knowledge Owner',
          sourceUrl: 'mock-drive://closed-db',
        }),
      });
      const body = (await response.json()) as { error: string; code: string };

      assert.equal(response.status, 500);
      assert.equal(body.code, 'INTERNAL_ERROR');
      assert.equal(typeof body.error, 'string');
    } finally {
      await server.close();
      await rm(lockedDir, { recursive: true, force: true });
    }
  });
});
