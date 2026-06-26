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

async function requestJson(route: string, init?: RequestInit): Promise<{ status: number; body: { error: string; code: string } }> {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
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
});
