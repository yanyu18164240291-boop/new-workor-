import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { getBottomNavItems, getOwnerHomePath } from '../src/frontend/routes.ts';
import { DEMO_NEWCOMER_ID } from '../src/frontend/demoConfig.ts';

describe('role navigation separation', () => {
  it('keeps newcomer, admin, and manager bottom navigation inside their own surface', () => {
    const newcomerHomePaths = getBottomNavItems('01').map((item) => item.path);
    assert.deepEqual(newcomerHomePaths, ['/', '/d1', '/permissions', '/weekly-feedback', '/anonymous-feedback']);
    assert.equal(getBottomNavItems('01')[0].label, '首页');

    const newcomerPaths = getBottomNavItems('02').map((item) => item.path);
    assert.deepEqual(newcomerPaths, ['/', '/d1', '/permissions', '/weekly-feedback', '/anonymous-feedback']);
    assert.equal(getBottomNavItems('02')[2].label, '权限申请');

    const adminPaths = getBottomNavItems('08').map((item) => item.path);
    assert.deepEqual(adminPaths, ['/admin-config', '/admin-config?tab=knowledge', '/admin-config?tab=feedback', '/review']);

    const managerPaths = getBottomNavItems('10').map((item) => item.path);
    assert.deepEqual(managerPaths, ['/manager', `/manager/newcomer/${DEMO_NEWCOMER_ID}`]);
  });

  it('routes header back action to the current surface home, not always the newcomer home', () => {
    assert.equal(getOwnerHomePath('newcomer'), '/');
    assert.equal(getOwnerHomePath('admin'), '/admin-config');
    assert.equal(getOwnerHomePath('manager'), '/manager');
  });

  it('keeps two-item manager bottom navigation evenly distributed', () => {
    const styles = readFileSync(new URL('../src/frontend/styles.css', import.meta.url), 'utf8');

    assert.match(styles, /\.bottom-nav:has\(button:nth-child\(2\):last-child\)/);
    assert.match(styles, /grid-template-columns:\s*repeat\(2,\s*1fr\)/);
  });
});
