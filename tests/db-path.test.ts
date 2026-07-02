import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { defaultDatabasePath } from '../src/server/db.ts';

const originalCwd = process.cwd();
let tempDir = '';

describe('database path resolution', () => {
  after(async () => {
    process.chdir(originalCwd);
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it('keeps the default SQLite file anchored to the project root instead of the launch cwd', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'haina-cwd-'));
    process.chdir(tempDir);

    const dbPath = defaultDatabasePath();

    assert.equal(path.basename(dbPath), 'haina-onboarding.db');
    assert.equal(path.basename(path.dirname(dbPath)), 'data');
    assert.ok(!dbPath.startsWith(tempDir), 'default database path must not follow the process launch cwd');
  });
});
