import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getShellKind, pageRoutes } from '../src/frontend/routes.ts';

describe('surface shell separation', () => {
  it('uses mobile shell for newcomer pages and desktop shell for admin pages', () => {
    const shells = Object.fromEntries(pageRoutes.map((route) => [route.pageNo, getShellKind(route)]));

    assert.equal(shells['01'], 'mobile');
    assert.equal(shells['05'], 'mobile');
    assert.equal(shells['08'], 'desktop');
    assert.equal(Object.values(shells).every((shell) => shell === 'mobile' || shell === 'desktop'), true);
  });
});
