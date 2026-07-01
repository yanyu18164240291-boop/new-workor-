import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('frontend architecture boundaries', () => {
  function collectSourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = `${dir}/${name}`;
      if (statSync(path).isDirectory()) return collectSourceFiles(path);
      return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : [];
    });
  }

  it('keeps role pages outside the application shell', () => {
    assert.equal(existsSync('src/frontend/pages/newcomerPages.tsx'), true);
    assert.equal(existsSync('src/frontend/pages/adminPages.tsx'), false);
    assert.equal(existsSync('src/frontend/pages/AdminConfig/AdminConfigPage.tsx'), true);
    assert.equal(existsSync('src/frontend/pages/ReviewPage.tsx'), true);
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
      'AdminConfigPage',
      'ReviewPage',
      'ManagerPage',
      'ManagerDetailPage',
      'ManagerFeedbackPage',
    ]) {
      assert.equal(app.includes(`function ${component}`), false, `${component} should live outside App.tsx`);
    }

    const appContent = readFileSync('src/frontend/AppContent.tsx', 'utf8');
    assert.equal(appContent.includes('adminPages'), false);
    assert.equal(appContent.includes('AdminPage'), false);
    assert.match(appContent, /AdminConfigPage/);
    assert.match(appContent, /ReviewPage/);
  });

  it('loads admin-only data only for the admin config route', () => {
    const app = readFileSync('src/frontend/App.tsx', 'utf8');
    const appState = readFileSync('src/frontend/appState.ts', 'utf8');
    assert.match(app, /useDashboardData\(route\.pageNo\)/);
    assert.match(appState, /loadDashboardDataForPage\(pageNo\)/);

    const extractFunction = (name: string) => {
      const start = appState.indexOf(`async function ${name}`);
      assert.notEqual(start, -1, `${name} should exist`);
      const next = appState.indexOf('\nasync function ', start + 1);
      return appState.slice(start, next === -1 ? undefined : next);
    };
    const newcomerLoader = extractFunction('loadNewcomerSurfaceData');
    const adminLoader = extractFunction('loadAdminConfigSurfaceData');
    const reviewLoader = extractFunction('loadReviewSurfaceData');
    const managerLoader = extractFunction('loadManagerSurfaceData');

    assert.match(adminLoader, /api\.getAdminConfig\(\)/);
    assert.match(adminLoader, /api\.getAnonymousFeedbacks\(\)/);
    assert.equal(newcomerLoader.includes('getAdminConfig'), false);
    assert.equal(newcomerLoader.includes('getAnonymousFeedbacks'), false);
    assert.equal(managerLoader.includes('getAdminConfig'), false);
    assert.equal(managerLoader.includes('getAnonymousFeedbacks'), false);
    assert.match(managerLoader, /api\.getRoles\(\)/);
    assert.match(managerLoader, /enabledRoleIds/);
    assert.equal(reviewLoader.includes('getAnonymousFeedbacks'), false);
  });

  it('keeps manager overview synchronized with enabled role data instead of hardcoded role counts', () => {
    const managerPages = readFileSync('src/frontend/pages/managerPages.tsx', 'utf8');
    assert.match(managerPages, /visibleManagerNewcomers/);
    assert.match(managerPages, /roleCounts/);
    assert.match(managerPages, /data\.roles/);
    assert.equal(managerPages.includes('今日新员工 2 人'), false);
    assert.equal(managerPages.includes('协同办公产品实习生 · D7'), false);
    assert.equal(managerPages.includes('产品实习生'), false);
  });

  it('keeps frontend HTTP access behind the API client', () => {
    assert.equal(existsSync('src/frontend/api.ts'), true);

    const apiClient = readFileSync('src/frontend/api.ts', 'utf8');
    assert.match(apiClient, /class ApiClientError/);
    assert.match(apiClient, /formatApiErrorMessage/);
    assert.match(apiClient, /fetch\(/);

    for (const file of collectSourceFiles('src/frontend').filter((file) => file !== 'src/frontend/api.ts')) {
      const source = readFileSync(file, 'utf8');
      assert.equal(source.includes('fetch('), false, `${file} should call the shared api client instead of fetch directly`);
    }
  });

  it('keeps backend HTTP server separate from API route SQL handlers', () => {
    assert.equal(existsSync('src/server/apiRoutes.ts'), true);
    assert.equal(existsSync('src/server/routeKit.ts'), true);
    assert.equal(existsSync('src/server/contracts.ts'), true);
    assert.equal(existsSync('src/server/errors.ts'), true);
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
