import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getBottomNavItems, getOwnerHomePath } from '../src/frontend/routes.ts';
import { DEMO_NEWCOMER_ID, DEMO_WEEKLY_FEEDBACK_ID } from '../src/frontend/demoConfig.ts';

describe('role navigation separation', () => {
  it('keeps newcomer, admin, and manager bottom navigation inside their own surface', () => {
    const newcomerHomePaths = getBottomNavItems('01').map((item) => item.path);
    assert.deepEqual(newcomerHomePaths, []);

    const newcomerPaths = getBottomNavItems('02').map((item) => item.path);
    assert.deepEqual(newcomerPaths, ['/', '/d1', '/permissions', '/weekly-feedback', '/anonymous-feedback']);
    assert.equal(getBottomNavItems('02')[2].label, '权限申请');

    const adminPaths = getBottomNavItems('08').map((item) => item.path);
    assert.deepEqual(adminPaths, ['/admin-config', '/admin-config?tab=knowledge', '/admin-config?tab=feedback', '/review']);

    const managerPaths = getBottomNavItems('10').map((item) => item.path);
    assert.deepEqual(managerPaths, ['/manager', `/manager/newcomer/${DEMO_NEWCOMER_ID}`, `/manager/feedback/${DEMO_WEEKLY_FEEDBACK_ID}`, '/manager']);
  });

  it('routes header back action to the current surface home, not always the newcomer home', () => {
    assert.equal(getOwnerHomePath('newcomer'), '/');
    assert.equal(getOwnerHomePath('admin'), '/admin-config');
    assert.equal(getOwnerHomePath('manager'), '/manager');
  });
});
