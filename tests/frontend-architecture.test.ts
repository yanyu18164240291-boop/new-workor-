import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('frontend architecture boundaries', () => {
  it('keeps role pages outside the application shell', () => {
    assert.equal(existsSync('src/frontend/pages/newcomerPages.tsx'), true);
    assert.equal(existsSync('src/frontend/pages/adminPages.tsx'), true);
    assert.equal(existsSync('src/frontend/pages/managerPages.tsx'), true);
    assert.equal(existsSync('src/frontend/AppContent.tsx'), true);
    assert.equal(existsSync('src/frontend/appState.ts'), true);

    const app = readFileSync('src/frontend/App.tsx', 'utf8');
    for (const component of [
      'HomePage',
      'D1Page',
      'PermissionPage',
      'PermissionDetailPage',
      'FollowUpPage',
      'WeeklyFeedbackPage',
      'AnonymousFeedbackPage',
      'AdminPage',
      'ReviewPage',
      'ManagerPage',
      'ManagerDetailPage',
      'ManagerFeedbackPage',
    ]) {
      assert.equal(app.includes(`function ${component}`), false, `${component} should live outside App.tsx`);
    }
  });

  it('keeps backend HTTP server separate from API route SQL handlers', () => {
    assert.equal(existsSync('src/server/apiRoutes.ts'), true);
    assert.equal(existsSync('src/server/routeKit.ts'), true);
    assert.equal(existsSync('src/server/routes/newcomerRoutes.ts'), true);
    assert.equal(existsSync('src/server/routes/adminRoutes.ts'), true);
    assert.equal(existsSync('src/server/routes/managerRoutes.ts'), true);
    assert.equal(existsSync('src/server/routes/reviewRoutes.ts'), true);

    const serverApp = readFileSync('src/server/app.ts', 'utf8');
    assert.equal(serverApp.includes('CREATE TABLE'), false);
    assert.equal(serverApp.includes('SELECT * FROM'), false);
    assert.equal(serverApp.includes('INSERT INTO'), false);
    assert.match(serverApp, /handleApiRequest/);

    const apiRoutes = readFileSync('src/server/apiRoutes.ts', 'utf8');
    assert.match(apiRoutes, /mergeRoutes/);
    assert.equal(apiRoutes.includes('SELECT * FROM'), false);
    assert.equal(apiRoutes.includes('INSERT INTO'), false);
    assert.equal(apiRoutes.includes('UPDATE '), false);
    assert.match(apiRoutes, /newcomerRoutes/);
    assert.match(apiRoutes, /adminRoutes/);
    assert.match(apiRoutes, /managerRoutes/);
    assert.match(apiRoutes, /reviewRoutes/);
  });
});
