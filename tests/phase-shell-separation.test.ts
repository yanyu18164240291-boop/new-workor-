import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getShellKind, pageRoutes } from '../src/frontend/routes.ts';

describe('surface shell separation', () => {
  it('uses mobile shell for newcomer and manager pages, and desktop shell for admin pages', () => {
    const shells = Object.fromEntries(pageRoutes.map((route) => [route.pageNo, getShellKind(route)]));

    assert.equal(shells['01'], 'mobile');
    assert.equal(shells['07'], 'mobile');
    assert.equal(shells['08'], 'desktop');
    assert.equal(shells['09'], 'desktop');
    assert.equal(shells['10'], 'mobile');
    assert.equal(shells['12'], 'mobile');
  });
});
