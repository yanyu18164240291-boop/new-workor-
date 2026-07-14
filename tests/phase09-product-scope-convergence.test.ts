import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { adminConfigTabs, resolveAdminConfigTab } from '../src/frontend/types/adminConfig.ts';
import { matchRoute, pageRoutes } from '../src/frontend/routes.ts';
import { activePageRoutePaths } from '../src/shared/pageRoutesContract.ts';

const removedFrontendRoutes = [
  '/d1',
  '/weekly-feedback',
  '/anonymous-feedback',
  '/review',
  '/manager',
  '/manager/newcomer/:id',
  '/manager/feedback/:id',
];

test('Phase 09 keeps only the interim newcomer and admin runtime routes', () => {
  const paths = pageRoutes.map((route) => route.path);
  assert.deepEqual(paths, ['/', '/permissions', '/permission-detail/:id', '/follow-up/:taskId', '/admin-config']);
  assert.deepEqual(activePageRoutePaths, paths);
  assert.equal(pageRoutes.every((route) => route.owner === 'newcomer' || route.owner === 'admin'), true);
  for (const path of removedFrontendRoutes) assert.equal(paths.includes(path), false);
  assert.equal(matchRoute('/manager').route.path, '/');
  assert.equal(matchRoute('/weekly-feedback').route.path, '/');
});

test('Phase 09 limits the admin console to active configuration modules', () => {
  assert.deepEqual(
    adminConfigTabs.map((tab) => tab.id),
    ['overview', 'role-packages', 'knowledge'],
  );
  assert.equal(resolveAdminConfigTab('tab=d1-guide'), 'overview');
  assert.equal(resolveAdminConfigTab('tab=feedback-pool'), 'overview');
});

test('Phase 09 unregisters removed backend modules and delivery triggers', () => {
  const apiRoutes = readFileSync('src/server/apiRoutes.ts', 'utf8');
  const newcomerRoutes = readFileSync('src/server/routes/newcomerRoutes.ts', 'utf8');
  const adminRoutes = readFileSync('src/server/routes/adminRoutes.ts', 'utf8');

  assert.equal(apiRoutes.includes('managerRoutes'), false);
  assert.equal(apiRoutes.includes('reviewRoutes'), false);
  for (const fragment of ['d1-guide-message', 'weekly-feedback', 'anonymous-feedback']) {
    assert.equal(newcomerRoutes.includes(fragment), false);
  }
  for (const fragment of ['d1-guide', 'weekly-feedback', 'anonymous-feedback']) {
    assert.equal(adminRoutes.includes(fragment), false);
  }
});

test('Phase 09 removes obsolete frontend API entry points', () => {
  const apiClient = readFileSync('src/frontend/api.ts', 'utf8');
  for (const method of [
    'getD1GuideConfig',
    'getWeeklyFeedbackConfig',
    'getAnonymousFeedbackConfig',
    'getReviewMetrics',
    'getManagerOverview',
    'sendD1GuideMessage',
    'submitWeeklyFeedback',
    'submitAnonymousFeedback',
  ]) {
    assert.equal(apiClient.includes(method), false);
  }
});

test('Phase 09 keeps legacy database history reversible', () => {
  const migration = readFileSync('db/migrations/001_initial.sql', 'utf8');
  const spec = readFileSync('docs/specs/phase-09-product-scope-convergence.md', 'utf8');

  for (const table of ['anonymous_feedbacks', 'weekly_feedbacks', 'manager_feedback_actions', 'd1_guide_configs']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(spec, /Do not drop SQLite tables/);
  assert.match(spec, /final page structure.*intentionally deferred/i);
});
