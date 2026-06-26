import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { adminConfigTabs, currentAdminUser } from '../src/frontend/types/adminConfig.ts';

describe('Phase 04A admin config workbench contract', () => {
  it('keeps all admin config modules inside /admin-config tabs', () => {
    assert.deepEqual(
      adminConfigTabs.map((tab) => tab.id),
      ['overview', 'role-packages', 'd1-guide', 'weekly-feedback', 'anonymous-config', 'knowledge', 'feedback-pool'],
    );
    assert.deepEqual(
      adminConfigTabs.map((tab) => tab.path),
      [
        '/admin-config?tab=overview',
        '/admin-config?tab=role-packages',
        '/admin-config?tab=d1-guide',
        '/admin-config?tab=weekly-feedback',
        '/admin-config?tab=anonymous-config',
        '/admin-config?tab=knowledge',
        '/admin-config?tab=feedback-pool',
      ],
    );
  });

  it('keeps the MVP operator fixed for audit fields', () => {
    assert.deepEqual(currentAdminUser, { name: 'demo-admin', role: '后台管理员' });
  });

  it('does not introduce standalone forbidden admin routes', () => {
    const routes = readFileSync('src/frontend/routes.ts', 'utf8');
    for (const forbidden of ['/admin/workbench', '/admin/newcomers', '/admin/review', '/admin/roles-audit', '/admin/permission-routes']) {
      assert.equal(routes.includes(forbidden), false, forbidden);
    }
  });

  it('keeps admin config saves behind a service layer', () => {
    const service = readFileSync('src/frontend/services/adminConfigApi.ts', 'utf8');
    assert.match(service, /saveRolePackagePermission/);
    assert.match(service, /saveD1GuideItem/);
    assert.match(service, /saveWeeklyFeedbackQuestion/);
    assert.match(service, /saveAnonymousFeedbackConfig/);
    assert.match(service, /uploadKnowledgeMetadata/);
    assert.match(service, /processAnonymousFeedback/);
    assert.match(service, /demo-admin/);
  });
});
