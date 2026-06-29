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

  it('renders role package permission fields without physical delete semantics', () => {
    const roleTab = readFileSync('src/frontend/pages/AdminConfig/RolePackagesTab.tsx', 'utf8');
    for (const label of [
      '权限名称',
      '所属分类',
      '权限类型',
      'Owner 类型',
      'Owner 名称',
      'Owner 联系方式',
      '申请入口名称',
      '申请入口 URL',
      '审批人',
      '理由模板',
      '常见等待原因',
      '启用状态',
    ]) {
      assert.match(roleTab, new RegExp(label));
    }
    assert.equal(roleTab.includes('删除'), false);
    assert.match(roleTab, /停用/);
  });

  it('renders fixed D1 guide actions without physical delete semantics', () => {
    const d1Tab = readFileSync('src/frontend/pages/AdminConfig/D1GuideTab.tsx', 'utf8');
    for (const label of ['D1 引导配置', '加入飞书部门群', '查看员工指南册', '打开岗位权限包', '编辑 / 停用', '/permissions']) {
      assert.match(d1Tab, new RegExp(label));
    }
    assert.equal(d1Tab.includes('删除'), false);
  });

  it('renders weekly feedback config fields without physical delete semantics', () => {
    const weeklyTab = readFileSync('src/frontend/pages/AdminConfig/WeeklyFeedbackTab.tsx', 'utf8');
    for (const label of ['首周反馈表', '问题标题', '问题说明', '输入类型', '是否必填', '最大字数', '选项列表', '问题启用状态', '编辑 / 复制 / 停用']) {
      assert.match(weeklyTab, new RegExp(label));
    }
    assert.equal(weeklyTab.includes('删除'), false);
  });

  it('renders editable anonymous feedback three-level config without physical delete semantics', () => {
    const anonymousTab = readFileSync('src/frontend/pages/AdminConfig/AnonymousConfigTab.tsx', 'utf8');
    for (const label of ['反馈模块列表', '当前模块', '问题类型', '希望如何处理', 'typeKey', 'actionKey', '是否需要补充文本']) {
      assert.match(anonymousTab, new RegExp(label));
    }
    assert.equal(anonymousTab.includes('删除'), false);
  });

  it('renders knowledge metadata management without real parsing or vector integration', () => {
    const knowledgeTab = readFileSync('src/frontend/pages/AdminConfig/KnowledgeTab.tsx', 'utf8');
    const uploadModal = readFileSync('src/frontend/components/admin-config/UploadKnowledgeModal.tsx', 'utf8');
    for (const label of ['知识库管理', '上传知识库资料', '文档名称', '知识分类', '适用岗位', '适用阶段', 'Owner', '解析状态', '向量化状态']) {
      assert.match(knowledgeTab, new RegExp(label));
    }
    for (const label of ['知识库上传窗口', '文件选择', '开始上传', '解析和向量化仍为模拟状态']) {
      assert.match(uploadModal, new RegExp(label));
    }
  });
});
