import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pageRoutes } from '../src/frontend/routes.ts';

describe('Phase 01 route map', () => {
  it('keeps only the interim Phase 09 newcomer and admin routes', () => {
    assert.equal(pageRoutes.length, 5);
    assert.deepEqual(
      pageRoutes.map((route) => [route.pageNo, route.path, route.title]),
      [
        ['01', '/', '新人首页 / 智能体主入口'],
        ['03', '/permissions', '岗位权限包'],
        ['04', '/permission-detail/:id', '权限详情 / 进度登记'],
        ['05', '/follow-up/:taskId', '4 小时回访 / 未完成处理'],
        ['08', '/admin-config', '后台配置维护台'],
      ],
    );
  });
});
