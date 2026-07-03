import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { createApiServer } from '../src/server/app.ts';
import { createDatabase } from '../src/server/db.ts';
import { runMigrations } from '../src/server/migrations.ts';
import { seedDatabase } from '../src/server/seed.ts';

test('declares Render-friendly production start settings', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
    engines?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  const serverEntry = await readFile('src/server/index.ts', 'utf8');

  assert.equal(packageJson.scripts?.start, 'node src/server/index.ts');
  assert.match(packageJson.engines?.node ?? '', /^>=24/);
  assert.match(serverEntry, /process\.env\.PORT/);
  assert.match(serverEntry, /host:\s*'0\.0\.0\.0'/);
});

test('serves the production frontend build and preserves API routes from one server', async () => {
  const root = await mkdtemp(join(tmpdir(), 'haina-render-deployment-'));
  const dist = join(root, 'dist');
  await mkdir(join(dist, 'assets'), { recursive: true });
  await writeFile(join(dist, 'index.html'), '<!doctype html><div id="root"></div>', 'utf8');
  await writeFile(join(dist, 'assets', 'app.js'), 'console.log("render-demo");', 'utf8');

  const db = createDatabase(join(root, 'test.db'));
  runMigrations(db);
  seedDatabase(db);
  const server = await createApiServer({ db, port: 0, staticDir: dist });

  try {
    const home = await fetch(`${server.baseUrl}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await home.text(), /id="root"/);

    const managerRoute = await fetch(`${server.baseUrl}/manager`);
    assert.equal(managerRoute.status, 200);
    assert.match(managerRoute.headers.get('content-type') ?? '', /text\/html/);

    const asset = await fetch(`${server.baseUrl}/assets/app.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type') ?? '', /javascript/);

    const api = await fetch(`${server.baseUrl}/api/roles`);
    assert.equal(api.status, 200);
    const payload = (await api.json()) as { data: unknown[] };
    assert.ok(payload.data.length > 0);
  } finally {
    await server.close();
  }
});
