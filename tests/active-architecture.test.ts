import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('Phase 09 active architecture boundaries', () => {
  it('keeps active surfaces split into newcomer pages and admin modules', () => {
    const appContent = readFileSync('src/frontend/AppContent.tsx', 'utf8');
    assert.match(appContent, /HomePage/);
    assert.match(appContent, /PermissionPage/);
    assert.match(appContent, /AdminConfigPage/);
    assert.doesNotMatch(appContent, /D1Page|WeeklyFeedbackPage|AnonymousFeedbackPage|ReviewPage|ManagerPage/);
  });

  it('loads no removed module data for newcomer or admin surfaces', () => {
    const appState = readFileSync('src/frontend/appState.ts', 'utf8');
    for (const method of [
      'getD1GuideConfig',
      'getWeeklyFeedbackConfig',
      'getAnonymousFeedbackConfig',
      'getReviewMetrics',
      'getManagerOverview',
      'getManagerNewcomerDetail',
    ]) {
      assert.equal(appState.includes(method), false);
    }
  });

  it('deletes isolated obsolete page and backend modules', () => {
    for (const path of [
      'src/frontend/pages/ReviewPage.tsx',
      'src/frontend/pages/managerPages.tsx',
      'src/frontend/pages/AdminConfig/D1GuideTab.tsx',
      'src/frontend/pages/AdminConfig/WeeklyFeedbackTab.tsx',
      'src/frontend/pages/AdminConfig/AnonymousConfigTab.tsx',
      'src/frontend/pages/AdminConfig/FeedbackPoolTab.tsx',
      'src/server/routes/managerRoutes.ts',
      'src/server/routes/reviewRoutes.ts',
      'src/server/services/managerService.ts',
      'src/server/services/reviewService.ts',
    ]) {
      assert.equal(existsSync(path), false, `${path} should be removed`);
    }
  });

  it('keeps frontend HTTP access behind the API client', () => {
    const sourceFiles = [
      'src/frontend/App.tsx',
      'src/frontend/AppContent.tsx',
      'src/frontend/appState.ts',
      'src/frontend/pages/newcomerPages.tsx',
      'src/frontend/pages/AdminConfig/AdminConfigPage.tsx',
    ];
    for (const file of sourceFiles) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), /\bfetch\s*\(/);
    }
  });
});

