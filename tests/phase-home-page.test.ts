import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as routes from '../src/frontend/routes.ts';

describe('newcomer home page model', () => {
  it('uses the unified bottom navigation for the home surface', () => {
    const navItems = routes.getBottomNavItems('01');
    assert.deepEqual(
      navItems.map((item) => [item.label, item.path]),
      [
        ['首页', '/'],
        ['D1引导', '/d1'],
        ['权限申请', '/permissions'],
        ['首周反馈', '/weekly-feedback'],
        ['匿名反馈', '/anonymous-feedback'],
      ],
    );
  });

  it('keeps exactly three common questions on the home chat dock', () => {
    assert.equal(typeof routes.getHomeQuickQuestions, 'function');

    assert.deepEqual(routes.getHomeQuickQuestions(), ['ChatGPT账号怎么申请？', 'OA系统怎么登录？', '我今天应该先做什么？']);
  });
});
