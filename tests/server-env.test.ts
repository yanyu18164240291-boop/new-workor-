import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';

import { loadServerEnv } from '../src/server/env.ts';

const originalEnv = { ...process.env };
const tempDirs: string[] = [];

describe('server environment loading', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  after(async () => {
    process.env = originalEnv;
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('loads local .env values for admin and Coze runtime configuration', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'haina-env-'));
    tempDirs.push(tempDir);
    const envPath = path.join(tempDir, '.env');
    await writeFile(
      envPath,
      [
        'HAINA_ADMIN_NAMES=燕余',
        'COZE_WORKFLOW_ID=workflow_from_env',
        'COZE_API_TOKEN=token_from_env',
      ].join('\n'),
      'utf8',
    );

    loadServerEnv(envPath);

    assert.equal(process.env.HAINA_ADMIN_NAMES, '燕余');
    assert.equal(process.env.COZE_WORKFLOW_ID, 'workflow_from_env');
    assert.equal(process.env.COZE_API_TOKEN, 'token_from_env');
  });
});
