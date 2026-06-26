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
    assert.equal(existsSync('src/server/contracts.ts'), true);
    assert.equal(existsSync('src/server/routes/newcomerRoutes.ts'), true);
    assert.equal(existsSync('src/server/routes/adminRoutes.ts'), true);
    assert.equal(existsSync('src/server/routes/managerRoutes.ts'), true);
    assert.equal(existsSync('src/server/routes/reviewRoutes.ts'), true);
    assert.equal(existsSync('src/server/services/newcomerService.ts'), true);
    assert.equal(existsSync('src/server/services/adminService.ts'), true);
    assert.equal(existsSync('src/server/services/managerService.ts'), true);
    assert.equal(existsSync('src/server/services/reviewService.ts'), true);
    assert.equal(existsSync('src/server/repositories/configRepository.ts'), true);
    assert.equal(existsSync('src/server/repositories/feedbackRepository.ts'), true);
    assert.equal(existsSync('src/server/repositories/metricsRepository.ts'), true);
    assert.equal(existsSync('src/server/repositories/permissionRepository.ts'), true);

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

    const routeKit = readFileSync('src/server/routeKit.ts', 'utf8');
    assert.equal(routeKit.includes('db.prepare'), false);
    assert.equal(routeKit.includes('SELECT * FROM'), false);
    assert.equal(routeKit.includes('INSERT INTO'), false);
    assert.equal(routeKit.includes('UPDATE '), false);

    for (const routeFile of [
      'src/server/routes/newcomerRoutes.ts',
      'src/server/routes/adminRoutes.ts',
      'src/server/routes/managerRoutes.ts',
      'src/server/routes/reviewRoutes.ts',
    ]) {
      const routeSource = readFileSync(routeFile, 'utf8');
      assert.equal(routeSource.includes('db.prepare'), false, `${routeFile} should delegate SQL work to services`);
      assert.equal(routeSource.includes('SELECT * FROM'), false, `${routeFile} should not contain read SQL`);
      assert.equal(routeSource.includes('INSERT INTO'), false, `${routeFile} should not contain insert SQL`);
      assert.equal(routeSource.includes('UPDATE '), false, `${routeFile} should not contain update SQL`);
      assert.match(routeSource, /handler: [a-zA-Z]/, `${routeFile} should map patterns to named service handlers`);
    }
  });
});
