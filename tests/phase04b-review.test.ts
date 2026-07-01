import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('Phase 04B review closeout', () => {
  it('keeps review as a read-only summary surface without anonymous raw feedback access', () => {
    const appState = readFileSync('src/frontend/appState.ts', 'utf8');
    const start = appState.indexOf('async function loadReviewSurfaceData');
    assert.notEqual(start, -1);
    const end = appState.indexOf('\nasync function ', start + 1);
    const reviewLoader = appState.slice(start, end === -1 ? undefined : end);

    assert.match(reviewLoader, /api\.getReviewMetrics\(\)/);
    assert.match(reviewLoader, /api\.getKnowledgeDocs\(\)/);
    assert.match(reviewLoader, /api\.getAnonymousFeedbackConfig\(\)/);
    assert.equal(reviewLoader.includes('getAnonymousFeedbacks'), false);
  });

  it('renders review explanations, empty states, and admin back-links for Phase 04B handoff', () => {
    const reviewPage = readFileSync('src/frontend/pages/ReviewPage.tsx', 'utf8');

    assert.match(reviewPage, /后台实时数据/);
    assert.match(reviewPage, /匿名反馈只进入类型统计和处理状态，不在复盘页展示原文/);
    assert.match(reviewPage, /review-empty-state/);
    assert.match(reviewPage, /review-next-actions/);
    assert.match(reviewPage, /\/admin-config\?tab=knowledge/);
    assert.match(reviewPage, /\/admin-config\?tab=feedback-pool/);
  });
});
