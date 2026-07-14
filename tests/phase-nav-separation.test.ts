import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getBottomNavItems, getOwnerHomePath } from '../src/frontend/routes.ts';

describe('role navigation separation', () => {
  it('keeps newcomer and admin navigation inside their own surface', () => {
    const newcomerHomePaths = getBottomNavItems('01').map((item) => item.path);
    assert.deepEqual(newcomerHomePaths, ['/', '/permissions']);
    assert.equal(getBottomNavItems('01')[0].label, '首页');

    const newcomerPaths = getBottomNavItems('03').map((item) => item.path);
    assert.deepEqual(newcomerPaths, ['/', '/permissions']);
    assert.equal(getBottomNavItems('03')[1].label, '权限申请');

    const adminPaths = getBottomNavItems('08').map((item) => item.path);
    assert.deepEqual(adminPaths, ['/admin-config', '/admin-config?tab=knowledge']);
  });

  it('routes header back action to the current surface home, not always the newcomer home', () => {
    assert.equal(getOwnerHomePath('newcomer'), '/');
    assert.equal(getOwnerHomePath('admin'), '/admin-config');
  });
});
