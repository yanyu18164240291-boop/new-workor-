import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { canAccessAdminConfig } from '../src/frontend/auth.ts';
import { validateD1GuideDraft } from '../src/frontend/pages/AdminConfig/d1GuideValidation.ts';
import { adminConfigTabs, currentAdminUser, defaultAdminConfigFilters, getTodayDateInputValue } from '../src/frontend/types/adminConfig.ts';

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

  it('uses the current day as the admin date filter default', () => {
    assert.equal(getTodayDateInputValue(new Date(2026, 5, 29)), '2026-06-29');
    assert.notEqual(defaultAdminConfigFilters.date, '2026-06-23');
  });

  it('guards admin-only pages behind the current admin user contract', () => {
    assert.equal(canAccessAdminConfig(currentAdminUser), true);
    assert.equal(canAccessAdminConfig({ name: 'newcomer-yanyu', role: '新人' }), false);

    const appContent = readFileSync('src/frontend/AppContent.tsx', 'utf8');
    assert.match(appContent, /canAccessAdminConfig/);
    assert.match(appContent, /case '08'/);
    assert.match(appContent, /case '09'/);
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
    assert.match(service, /currentAdminUser\.name/);
    assert.match(service, /updatedBy: adminActorName/);
  });

  it('renders the fixed sidebar and topbar copy from the admin prototype', () => {
    const sidebar = readFileSync('src/frontend/components/admin-config/AdminSidebar.tsx', 'utf8');
    const topbar = readFileSync('src/frontend/components/admin-config/AdminTopbar.tsx', 'utf8');
    const app = readFileSync('src/frontend/App.tsx', 'utf8');
    const styles = readFileSync('src/frontend/styles.css', 'utf8');
    assert.match(sidebar, /海纳AI入职Bot/);
    assert.match(sidebar, /后台配置台/);
    assert.match(sidebar, /核心配置/);
    assert.equal(sidebar.includes('收起菜单'), false);
    assert.match(sidebar, /© 2026 Haidilao/);
    assert.match(sidebar, /v1\.0\.0/);
    assert.match(styles, /admin-compact-summary-grid/);
    assert.match(styles, /admin-role-info-card/);
    assert.match(topbar, /搜索岗位、权限、文档、反馈/);
    assert.match(topbar, /全部组织/);
    assert.match(topbar, /全部状态/);
    assert.match(topbar, /2026-06-23/);
    assert.match(topbar, /type="date"/);
    assert.match(topbar, /demo-admin/);
    assert.match(topbar, /刷新数据/);
    assert.equal(app.includes('AdminPage'), false);
    assert.match(app, /route\.pageNo === '08'/);
    assert.match(styles, /\.admin-workbench-content\s*{[^}]*width:\s*100%/s);
  });

  it('renders overview metrics, queues, change log, and quick actions', () => {
    const overview = readFileSync('src/frontend/pages/AdminConfig/OverviewTab.tsx', 'utf8');
    assert.match(overview, /filters\.date/);
    assert.match(overview, /isOnOrBeforeDate/);
    assert.doesNotMatch(overview, /vectorStatus !== 'simulated_vectorized'/);
    for (const label of ['岗位数', '权限项数', '知识库资料数', '待处理匿名反馈数', '配置完整度', '待处理事项', '最近变更记录', '快捷操作']) {
      assert.match(overview, new RegExp(label));
    }
    for (const quickAction of ['新增权限项', '新增岗位', '设置 D1 引导', '新增反馈问题', '上传知识库资料', '查看反馈池']) {
      assert.match(overview, new RegExp(quickAction));
    }
  });

  it('renders role package permission fields without physical delete semantics', () => {
    const roleTab = readFileSync('src/frontend/pages/AdminConfig/RolePackagesTab.tsx', 'utf8');
    const service = readFileSync('src/frontend/services/adminConfigApi.ts', 'utf8');
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
    assert.match(roleTab, /绑定已有权限/);
    assert.match(roleTab, /getPermissionDisableHint/);
    assert.match(roleTab, /必开权限不能停用/);
    assert.match(roleTab, /isRequiredPermission\(draft\)/);
    assert.match(service, /bindExistingPermissionForRole/);
    assert.match(service, /createRolePermissionItem/);
    assert.doesNotMatch(roleTab, /rolePermissionIds\.size\s*>\s*0\s*\?/);
  });

  it('renders department and role scoped D1 guide tasks with editable real resources', () => {
    const d1Tab = readFileSync('src/frontend/pages/AdminConfig/D1GuideTab.tsx', 'utf8');
    for (const label of ['D1 引导配置', '加入飞书部门群', '查看员工指南册', '开通岗位权限包', '新增引导任务', '引导任务', '多群资源列表', '/permissions']) {
      assert.match(d1Tab, new RegExp(label));
    }
    assert.match(d1Tab, /organizationPath/);
    assert.match(d1Tab, /departmentName/);
    assert.match(d1Tab, /roleName/);
    assert.match(d1Tab, /resourceLinks/);
    assert.match(d1Tab, /删除/);
    assert.match(d1Tab, /启用/);
  });

  it('validates D1 guide draft links and routes before submitting', () => {
    assert.equal(
      validateD1GuideDraft({
        actionKey: 'permission_package',
        title: '开通岗位权限包',
        description: '开通岗位权限包',
        label: '开通',
        ownerName: 'Permission Admin',
        routePath: '/permissions',
        enabled: true,
      }),
      '',
    );
    assert.match(
      validateD1GuideDraft({
        actionKey: 'permission_package',
        title: '开通岗位权限包',
        description: '开通岗位权限包',
        label: '开通',
        ownerName: 'Permission Admin',
        routePath: '/admin/workbench',
        enabled: true,
      }),
      /路由/,
    );
    assert.match(
      validateD1GuideDraft({
        actionKey: 'employee_guide',
        title: '查看员工指南册',
        description: '查看指南',
        label: '查看',
        ownerName: 'Content Admin',
        documentTitle: '指南册',
        documentUrl: 'not-a-url',
        enabled: true,
      }),
      /链接/,
    );
  });

  it('renders weekly feedback config fields without physical delete semantics', () => {
    const weeklyTab = readFileSync('src/frontend/pages/AdminConfig/WeeklyFeedbackTab.tsx', 'utf8');
    const dataTable = readFileSync('src/frontend/components/admin-config/DataTable.tsx', 'utf8');
    for (const label of ['首周反馈表', '问题标题', '问题说明', '输入类型', '是否必填', '最大字数', '选项列表', '选项文案', '排序', '问题启用状态']) {
      assert.match(weeklyTab, new RegExp(label));
    }
    assert.equal(weeklyTab.includes('删除'), false);
    assert.equal(weeklyTab.includes('表格操作'), false);
    assert.match(weeklyTab, /formatOptionSummary/);
    assert.match(weeklyTab, /option\.label/);
    assert.match(weeklyTab, /questionId is invalid/);
    assert.match(weeklyTab, /已按新问题保存/);
    assert.match(weeklyTab, /ChevronUp/);
    assert.match(weeklyTab, /ChevronDown/);
    assert.match(weeklyTab, /moveQuestionByStep/);
    assert.match(weeklyTab, /admin-order-controls/);
    assert.doesNotMatch(weeklyTab, /draggable=/);
    assert.match(weeklyTab, /reorderWeeklyFeedbackQuestions/);
    assert.match(dataTable, /getRowProps/);
  });

  it('renders editable anonymous feedback three-level config without physical delete semantics', () => {
    const anonymousTab = readFileSync('src/frontend/pages/AdminConfig/AnonymousConfigTab.tsx', 'utf8');
    const newcomerPages = readFileSync('src/frontend/pages/newcomerPages.tsx', 'utf8');
    for (const label of [
      '反馈模块列表',
      '当前关联模块',
      '当前模块',
      '问题类型',
      '希望如何处理',
      '新增问题类型',
      '新增处理方式',
      'typeKey',
      'actionKey',
      '是否需要补充文本',
    ]) {
      assert.match(anonymousTab, new RegExp(label));
    }
    assert.match(anonymousTab, /selectedModuleId/);
    assert.match(anonymousTab, /moduleId:\s*selectedModule\.id/);
    assert.match(anonymousTab, /selectedModule\?\.problemTypes/);
    assert.match(anonymousTab, /selectedModule\?\.expectedActions/);
    assert.match(newcomerPages, /selectedModule\?\.problemTypes/);
    assert.match(newcomerPages, /selectedModule\?\.expectedActions/);
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
    assert.match(uploadModal, /KNOWLEDGE_CATEGORIES/);
    assert.match(uploadModal, /<select value=\{draft\.category\}/);
    assert.match(knowledgeTab, /canEnableKnowledgeDoc\(doc\.parseStatus,\s*doc\.vectorStatus\)/);
    assert.match(knowledgeTab, /文档尚未解析\/向量化完成，无法启用/);
    assert.match(knowledgeTab, /title=\{getKnowledgeEnableHint\(doc\)\}/);
  });

  it('renders anonymous feedback pool processing fields and status mapping', () => {
    const poolTab = readFileSync('src/frontend/pages/AdminConfig/FeedbackPoolTab.tsx', 'utf8');
    const service = readFileSync('src/frontend/services/adminConfigApi.ts', 'utf8');
    for (const label of ['待处理', '处理中', '已补充知识库', '已修正权限入口', '暂不处理', '已关闭']) {
      assert.match(poolTab, new RegExp(label));
    }
    for (const value of ['pending', 'in_progress', 'knowledge_added', 'permission_entry_fixed', 'deferred', 'closed']) {
      assert.match(poolTab, new RegExp(value));
    }
    for (const field of [
      'handlerName',
      'handledAt',
      'resolutionNote',
      'includedInReview',
      '关联知识库资料',
      'relatedKnowledgeDocId',
      '关联岗位权限包',
      'relatedRoleId',
    ]) {
      assert.match(poolTab, new RegExp(field));
    }
    assert.match(poolTab, /请选择关联岗位权限包/);
    assert.match(poolTab, /关联岗位权限包：/);
    assert.match(poolTab, /admin-description-cell/);
    assert.match(poolTab, /listKnowledgeDocsForFeedbackAction/);
    assert.match(service, /listKnowledgeDocsForFeedbackAction/);
    assert.equal(poolTab.includes('open / resolved / archived'), false);
    assert.equal(poolTab.includes('兼容历史状态'), false);
  });
});
