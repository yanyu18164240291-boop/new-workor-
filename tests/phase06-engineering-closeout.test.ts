import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const closeoutPath = 'docs/qa/phase-06-engineering-closeout.md';
const ledgerPath = 'docs/qa/phase-06-bugfix-ledger.md';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('Phase 06 engineering closeout governance', () => {
  it('keeps an auditable bugfix ledger for the accepted demo baseline', () => {
    assert.equal(existsSync(ledgerPath), true);
    const ledger = source(ledgerPath);

    assert.match(ledger, /codex\/render-demo-deploy/);
    assert.match(ledger, /codex\/newcomer-home-input-bugfix/);
    assert.match(ledger, /92ad992 fix: adapt preset question cards to feishu style/);
    assert.match(ledger, /f64ef8f fix: refine home history typography/);
    assert.match(ledger, /npm\.cmd test/);
    assert.match(ledger, /npm\.cmd run build/);
    assert.match(ledger, /Render/);
    assert.match(ledger, /master/);
  });

  it('documents the mandatory engineering gates before further pilot work', () => {
    assert.equal(existsSync(closeoutPath), true);
    const closeout = source(closeoutPath);

    for (const required of [
      'npm.cmd test',
      'npm.cmd run build',
      'git diff --check',
      'git status --short --branch',
      'codex/render-demo-deploy',
      'codex/phase-06-engineering-closeout',
      'https://haina-onboarding-h5-demo.onrender.com',
    ]) {
      assert.match(closeout, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  it('keeps a three-surface smoke matrix tied to existing automated tests', () => {
    const closeout = source(closeoutPath);

    for (const route of [
      '/',
      '/d1',
      '/permissions',
      '/permission-detail/perm-oa',
      '/follow-up/follow-up-yanyu-oa',
      '/weekly-feedback',
      '/anonymous-feedback',
      '/admin-config',
      '/admin-config?tab=knowledge',
      '/admin-config?tab=feedback',
      '/review',
      '/manager',
      '/manager/newcomer/newcomer-yanyu',
      '/manager/feedback/weekly-yanyu',
    ]) {
      assert.match(closeout, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    for (const testFile of [
      'tests/home-chat-model.test.ts',
      'tests/frontend-structure.test.ts',
      'tests/phase00-api.test.ts',
      'tests/phase04a-admin-config.test.ts',
      'tests/phase04a-admin-config-workbench.test.ts',
      'tests/phase04b-review.test.ts',
      'tests/phase05-manager-flow.test.ts',
    ]) {
      assert.match(closeout, new RegExp(testFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.equal(existsSync(testFile), true, `${testFile} should exist as a referenced guardrail`);
    }
  });

  it('keeps P0 persistence, access control, and deployment rollback decisions explicit', () => {
    const closeout = source(closeoutPath);

    for (const required of [
      'permission_progress',
      'follow_up_tasks',
      'weekly_feedbacks',
      'weekly_feedback_answers',
      'anonymous_feedbacks',
      'manager_feedback_actions',
      'HAINA_DB_PATH',
      'Copy-Item',
      'git revert',
      '/api/roles',
      '/api/admin/*',
      '/api/manager/*',
      '不是真登录',
      '真实飞书登录',
      '真实审批提交',
      '真实 RAG',
    ]) {
      assert.match(closeout, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});
