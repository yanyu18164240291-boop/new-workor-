import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(route.startsWith('/api/admin/') || route.startsWith('/api/admin-config/')
        ? { 'x-haina-role': 'admin', 'x-haina-actor': 'demo-admin' }
        : {}),
      ...(init?.headers ?? {}),
    },
  });
  return {
    status: response.status,
    body: (await response.json()) as T,
  };
}

describe('Phase 08 AI QA RAG knowledge base', () => {
  before(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'haina-phase08-'));
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

  it('documents Phase 08 scope without MySQL migration or real approval flow', () => {
    const spec = readFileSync('docs/specs/phase-08-ai-qa-rag-knowledgebase.md', 'utf8');

    assert.match(spec, /首页 AI 对话问答/);
    assert.match(spec, /最小可用 RAG/);
    assert.match(spec, /不修改 MySQL/);
    assert.match(spec, /不进入真实审批流程/);
    assert.match(spec, /SQLite/);
    assert.match(spec, /Acceptance Criteria/);
  });

  it('stores admin knowledge content as retrievable backend data', async () => {
    const created = await requestJson<{
      data: {
        id: string;
        title: string;
        contentText: string;
        retrievalKeywords: string;
        parseStatus: string;
        vectorStatus: string;
      };
    }>('/api/admin/knowledge-base-docs', {
      method: 'POST',
      body: JSON.stringify({
        title: 'VPN 开通说明',
        category: '系统权限',
        applicableRoleId: 'role-product-intern',
        applicableRole: '协同办公产品实习生',
        applicableStage: 'D1-D7',
        ownerName: 'IT 支持组',
        sourceUrl: 'mock-drive://vpn-guide',
        contentText: 'VPN 需要先完成 OA 账号开通，再在权限包中登记 VPN 申请。遇到等待时联系 IT 支持组。',
        retrievalKeywords: 'VPN,OA,权限包,IT支持',
      }),
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.title, 'VPN 开通说明');
    assert.match(created.body.data.contentText, /VPN 需要先完成 OA/);
    assert.equal(created.body.data.retrievalKeywords, 'VPN,OA,权限包,IT支持');
    assert.equal(created.body.data.parseStatus, 'pending');
    assert.equal(created.body.data.vectorStatus, 'pending');
  });

  it('answers newcomer home questions through backend RAG with citations and hit count updates', async () => {
    const created = await requestJson<{ data: { id: string } }>('/api/admin/knowledge-base-docs', {
      method: 'POST',
      body: JSON.stringify({
        title: 'VPN 开通说明',
        category: '系统权限',
        applicableRoleId: 'role-product-intern',
        applicableRole: '协同办公产品实习生',
        applicableStage: 'D1-D7',
        ownerName: 'IT 支持组',
        sourceUrl: 'mock-drive://vpn-rag',
        contentText: 'VPN 需要先完成 OA 账号开通，再在岗位权限包中登记 VPN 申请。等待超过 4 小时可以联系 IT 支持组。',
        retrievalKeywords: 'VPN,OA,岗位权限包,IT支持',
      }),
    });
    await requestJson(`/api/admin-config/knowledge/${created.body.data.id}/trigger-mock-parse`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    await requestJson(`/api/admin-config/knowledge/${created.body.data.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'enabled' }),
    });

    const answer = await requestJson<{
      data: {
        mode: string;
        answer: string;
        citations: Array<{ docId: string; title: string; ownerName: string }>;
      };
    }>('/api/newcomers/newcomer-yanyu/ai-chat', {
      method: 'POST',
      body: JSON.stringify({ question: 'VPN 怎么开通？' }),
    });

    assert.equal(answer.status, 200);
    assert.equal(answer.body.data.mode, 'local_rag');
    assert.match(answer.body.data.answer, /OA 账号开通/);
    assert.match(answer.body.data.answer, /岗位权限包/);
    assert.deepEqual(answer.body.data.citations.map((citation) => citation.title), ['VPN 开通说明']);

    const docs = await requestJson<{ data: Array<{ id: string; hitCount: number }> }>('/api/admin/knowledge-base-docs');
    const reloaded = docs.body.data.find((doc) => doc.id === created.body.data.id);
    assert.ok(reloaded);
    assert.equal(reloaded.hitCount, 1);
  });

  it('falls back safely when no enabled knowledge document matches the question', async () => {
    const answer = await requestJson<{ data: { mode: string; answer: string; citations: unknown[] } }>('/api/newcomers/newcomer-yanyu/ai-chat', {
      method: 'POST',
      body: JSON.stringify({ question: '公司健身房在哪里？' }),
    });

    assert.equal(answer.status, 200);
    assert.equal(answer.body.data.mode, 'no_match');
    assert.equal(answer.body.data.citations.length, 0);
    assert.match(answer.body.data.answer, /暂时没有找到/);
  });
});
