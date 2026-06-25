import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pageRoutes } from '../src/frontend/routes.ts';

describe('Phase 01 route map', () => {
  it('defines exactly the final 12 H5 pages with stable page numbers and titles', () => {
    assert.equal(pageRoutes.length, 12);
    assert.deepEqual(
      pageRoutes.map((route) => [route.pageNo, route.path, route.title]),
      [
        ['01', '/', '新人首页 / 智能体主入口'],
        ['02', '/d1', 'D1 到达引导包'],
        ['03', '/permissions', '岗位权限包'],
        ['04', '/permission-detail/:id', '权限详情 / 进度登记'],
        ['05', '/follow-up/:taskId', '4 小时回访 / 未完成处理'],
        ['06', '/weekly-feedback', '新人首周反馈填写'],
        ['07', '/anonymous-feedback', '匿名反馈'],
        ['08', '/admin-config', '后台配置维护台'],
        ['09', '/review', 'V1 灰度试点复盘'],
        ['10', '/manager', '管理者首页 / 今日新员工概览'],
        ['11', '/manager/newcomer/:id', '新人首周跟踪详情'],
        ['12', '/manager/feedback/:id', '管理者视角 / 新人首周反馈'],
      ],
    );
  });
});
