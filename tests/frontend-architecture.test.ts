import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('frontend architecture boundaries', () => {
  it('keeps newcomer pages outside the application shell', () => {
    assert.equal(existsSync('src/frontend/pages/newcomerPages.tsx'), true);

    const app = readFileSync('src/frontend/App.tsx', 'utf8');
    for (const component of [
      'HomePage',
      'D1Page',
      'PermissionPage',
      'PermissionDetailPage',
      'FollowUpPage',
      'WeeklyFeedbackPage',
      'AnonymousFeedbackPage',
    ]) {
      assert.equal(app.includes(`function ${component}`), false, `${component} should live in pages/newcomerPages.tsx`);
    }
  });
});
