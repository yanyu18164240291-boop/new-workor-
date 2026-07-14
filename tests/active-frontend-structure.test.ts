import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('Phase 09 active frontend regressions', () => {
  it('keeps the home AI and permission progress experience intact', () => {
    const pages = readFileSync('src/frontend/pages/newcomerPages.tsx', 'utf8');
    assert.match(pages, /className="home-bot-row"/);
    assert.match(pages, /className="home-progress-card"/);
    assert.match(pages, /api\.askHomeAi/);
    assert.match(pages, /export function PermissionPage/);
    assert.match(pages, /export function PermissionDetailPage/);
    assert.match(pages, /export function FollowUpPage/);
    assert.doesNotMatch(pages, /export function D1Page|export function WeeklyFeedbackPage|export function AnonymousFeedbackPage/);
  });

  it('keeps permission submission in-system and persistent', () => {
    const pages = readFileSync('src/frontend/pages/newcomerPages.tsx', 'utf8');
    const permissionDetail = pages.slice(pages.indexOf('export function PermissionDetailPage'), pages.indexOf('export function FollowUpPage'));
    assert.match(permissionDetail, /api\.submitPermissionProgress/);
    assert.match(permissionDetail, /暂不进入真实审批流程/);
    assert.doesNotMatch(permissionDetail, /已打开真实审批入口/);
  });

  it('keeps cached data visible during background refresh', () => {
    const state = readFileSync('src/frontend/appState.ts', 'utf8');
    const app = readFileSync('src/frontend/App.tsx', 'utf8');
    assert.match(state, /dashboardDataCache/);
    assert.match(state, /__staleWhileRevalidate/);
    assert.match(app, /const canRenderContent = status === 'ready' \|\| Boolean\(data\.__staleWhileRevalidate\)/);
  });
});
