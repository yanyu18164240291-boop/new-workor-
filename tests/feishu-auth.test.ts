import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';

import { createApiServer } from '../src/server/app.ts';
import { createDatabase } from '../src/server/db.ts';
import { runMigrations } from '../src/server/migrations.ts';
import { seedDatabase } from '../src/server/seed.ts';

const nativeFetch = globalThis.fetch.bind(globalThis);
const originalEnv = { ...process.env };
const tempDirs: string[] = [];

async function createServer() {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'haina-feishu-auth-'));
  tempDirs.push(tempDir);
  const db = createDatabase(path.join(tempDir, 'test.db'));
  runMigrations(db);
  seedDatabase(db);
  return createApiServer({ db, port: 0 });
}

function configureFeishuAuth(baseUrl: string) {
  process.env.FEISHU_APP_ID = 'cli_test_app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_REDIRECT_URI = `${baseUrl}/api/auth/feishu/callback`;
  process.env.FEISHU_TEST_NEWCOMER_ID = 'newcomer-yanyu';
}

describe('Feishu OAuth login', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = nativeFetch;
  });

  after(async () => {
    globalThis.fetch = nativeFetch;
    process.env = originalEnv;
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('keeps auth disabled when Feishu secrets are not configured', async () => {
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_APP_SECRET;
    delete process.env.FEISHU_REDIRECT_URI;
    const server = await createServer();
    try {
      const response = await nativeFetch(`${server.baseUrl}/api/auth/session`);
      const body = (await response.json()) as { data: { enabled: boolean; authenticated: boolean } };

      assert.equal(response.status, 200);
      assert.deepEqual(body.data, { enabled: false, authenticated: true, user: null });
    } finally {
      await server.close();
    }
  });

  it('redirects to Feishu authorization without exposing the app secret', async () => {
    const server = await createServer();
    configureFeishuAuth(server.baseUrl);
    try {
      const response = await nativeFetch(`${server.baseUrl}/api/auth/feishu/start?returnTo=%2Fweekly-feedback`, { redirect: 'manual' });
      const location = response.headers.get('location') ?? '';

      assert.equal(response.status, 302);
      assert.match(location, /^https:\/\/open\.feishu\.cn\/open-apis\/authen\/v1\/index/);
      assert.match(location, /app_id=cli_test_app/);
      assert.match(location, /redirect_uri=/);
      assert.match(location, /state=/);
      assert.doesNotMatch(location, /test-secret/);
    } finally {
      await server.close();
    }
  });

  it('exchanges callback code for a Feishu user session cookie', async () => {
    const server = await createServer();
    configureFeishuAuth(server.baseUrl);
    const calls: Array<{ url: string; auth?: string }> = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, auth: init?.headers instanceof Headers ? init.headers.get('authorization') ?? undefined : (init?.headers as Record<string, string> | undefined)?.authorization });
      if (url.includes('/authen/v2/oauth/token')) {
        return Response.json({ code: 0, msg: 'ok', access_token: 'user-token' });
      }
      if (url.includes('/authen/v1/user_info')) {
        return Response.json({ code: 0, msg: 'ok', data: { open_id: 'ou_test', user_id: 'user_test', name: '燕余' } });
      }
      if (url.includes('/auth/v3/tenant_access_token/internal')) {
        return Response.json({ code: 0, msg: 'ok', tenant_access_token: 'tenant-token' });
      }
      if (url.includes('/im/v1/messages')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { receive_id?: string; msg_type?: string; content?: string };
        const content = JSON.parse(body.content ?? '{}') as { text?: string };
        assert.equal(body.receive_id, 'ou_test');
        assert.equal(body.msg_type, 'text');
        assert.match(content.text ?? '', /燕余您好呀！这是你的 D1 到达引导/);
        assert.match(content.text ?? '', /飞书管理员保存的权限包/);
        return Response.json({ code: 0, msg: 'ok', data: { message_id: 'om_d1_guide' } });
      }
      if (url.includes('/contact/v3/users/user_test')) {
        return Response.json({ code: 0, msg: 'ok', data: { user: { department_ids: ['od_child'], job_title: '产品实习生' } } });
      }
      if (url.includes('/contact/v3/departments/od_child')) {
        return Response.json({ code: 0, msg: 'ok', data: { department: { name: '协同办公组', parent_department_id: 'od_parent' } } });
      }
      if (url.includes('/contact/v3/departments/od_parent')) {
        return Response.json({ code: 0, msg: 'ok', data: { department: { name: '信息技术部', parent_department_id: '0' } } });
      }
      return nativeFetch(input, init);
    }) as typeof fetch;

    try {
      const start = await nativeFetch(`${server.baseUrl}/api/auth/feishu/start?returnTo=%2F`, { redirect: 'manual' });
      const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');
      assert.ok(state);

      const callback = await nativeFetch(`${server.baseUrl}/api/auth/feishu/callback?code=login-code&state=${state}`, { redirect: 'manual' });
      const cookie = callback.headers.get('set-cookie') ?? '';

      assert.equal(callback.status, 302);
      assert.equal(callback.headers.get('location'), '/');
      assert.match(cookie, /haina_feishu_session=/);
      assert.ok(calls.some((call) => call.url.includes('/authen/v2/oauth/token') && call.auth === undefined));
      assert.ok(calls.some((call) => call.url.includes('/authen/v1/user_info') && call.auth === 'Bearer user-token'));
      assert.ok(calls.some((call) => call.url.includes('/contact/v3/users/user_test') && call.auth === 'Bearer tenant-token'));

      const session = await nativeFetch(`${server.baseUrl}/api/auth/session`, { headers: { cookie } });
      const sessionBody = (await session.json()) as {
        data: { authenticated: boolean; user: { name: string; newcomerId: string; departmentName?: string; jobTitle?: string } };
      };
      assert.equal(sessionBody.data.authenticated, true);
      assert.equal(sessionBody.data.user.name, '燕余');
      assert.equal(sessionBody.data.user.departmentName, '信息技术部-协同办公组');
      assert.equal(sessionBody.data.user.jobTitle, '产品实习生');
      assert.equal(sessionBody.data.user.newcomerId, 'newcomer-yanyu');

      const adminSave = await nativeFetch(`${server.baseUrl}/api/admin/d1-guide-config`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          items: [
            {
              actionKey: 'permission_package',
              taskType: 'permission_package',
              title: '飞书管理员保存的权限包',
              description: '通过飞书登录用户保存。',
              routePath: '/permissions',
              label: '开通权限',
              ownerName: '燕余',
              enabled: true,
            },
          ],
        }),
      });
      const adminSaveBody = (await adminSave.json()) as { data: { permissionPackage: { updatedBy: string } } };
      assert.equal(adminSave.status, 200);
      assert.equal(adminSaveBody.data.permissionPackage.updatedBy, '燕余');

      const d1Push = await nativeFetch(`${server.baseUrl}/api/newcomers/newcomer-yanyu/d1-guide-message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ roleId: 'role-product-intern' }),
      });
      const d1PushBody = (await d1Push.json()) as {
        data: { deliveryStatus: string; messageId: string; recipientName: string; itemCount: number };
      };
      assert.equal(d1Push.status, 200);
      assert.equal(d1PushBody.data.deliveryStatus, 'sent');
      assert.equal(d1PushBody.data.messageId, 'om_d1_guide');
      assert.equal(d1PushBody.data.recipientName, '燕余');
      assert.ok(calls.some((call) => call.url.includes('/im/v1/messages') && call.auth === 'Bearer tenant-token'));
    } finally {
      await server.close();
    }
  });
});
