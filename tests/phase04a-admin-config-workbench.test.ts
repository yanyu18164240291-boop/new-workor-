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

  it('renders the fixed sidebar and topbar copy from the admin prototype', () => {
    const sidebar = readFileSync('src/frontend/components/admin-config/AdminSidebar.tsx', 'utf8');
    const topbar = readFileSync('src/frontend/components/admin-config/AdminTopbar.tsx', 'utf8');
    assert.match(sidebar, /海纳AI入职Bot/);
    assert.match(sidebar, /后台配置台/);
    assert.match(sidebar, /核心配置/);
    assert.match(sidebar, /收起菜单/);
    assert.match(sidebar, /© 2026 Haidilao/);
    assert.match(sidebar, /v1\.0\.0/);
    assert.match(topbar, /搜索岗位、权限、文档、反馈/);
    assert.match(topbar, /全部组织/);
    assert.match(topbar, /全部状态/);
    assert.match(topbar, /2026-06-23/);
    assert.match(topbar, /demo-admin/);
    assert.match(topbar, /刷新数据/);
  });

  it('renders overview metrics, queues, change log, and quick actions', () => {
    const overview = readFileSync('src/frontend/pages/AdminConfig/OverviewTab.tsx', 'utf8');
    for (const label of ['岗位数', '权限项数', '知识库资料数', '待处理匿名反馈数', '配置完整度', '待处理事项', '最近变更记录', '快捷操作']) {
      assert.match(overview, new RegExp(label));
    }
    for (const quickAction of ['新增权限项', '新增岗位', '设置 D1 引导', '新增反馈问题', '上传知识库资料', '查看反馈池']) {
      assert.match(overview, new RegExp(quickAction));
    }
  });
});
