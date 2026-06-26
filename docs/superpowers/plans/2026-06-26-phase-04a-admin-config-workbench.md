# Phase 04A Admin Config Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Page 08 `/admin-config` as a desktop web operations configuration workbench, using the user's text constraints as business logic and the seven prototype images as UI reference.

**Architecture:** Preserve the existing real backend and database as the source of truth for P0 data. Add a focused frontend admin-config service layer over the existing unified API client, then split the current single `AdminPage` into a desktop layout and seven low-coupled tab modules. Keep newcomer and review pages reading the same backend configuration, so admin saves survive reload and flow through to `/d1`, `/permissions`, `/weekly-feedback`, `/anonymous-feedback`, and `/review`.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner, existing SQLite-backed API server, existing `src/frontend/api.ts` request client.

---

## Source Rules

- Business logic priority: the user's written Phase 04A constraint message.
- UI priority: `C:\yanyu\新人入职BAT\开发前\后台原型图.zip`, extracted locally to `.prototype-reference/admin-config/后台原型图/*.png`.
- Existing project guardrails: `AGENTS.md`, `.agents/skills/haina-onboarding-h5/SKILL.md`, `docs/specs/phase-04-admin-and-review.md`.
- Important reconciliation: the user suggested mock service naming, but this repository already has real P0 backend writes and tests. Implement `src/frontend/services/adminConfigApi.ts` as a frontend service wrapper over real API calls, not as frontend-only state.

## Current Baseline

- Worktree: `C:\Users\HDL\Documents\海纳入职Bot开发\.worktrees\phase-04a-admin-config-workbench`
- Branch: `codex/phase-04a-admin-config-workbench`
- Baseline test: `npm.cmd test` passes, 48 tests, 0 failures.
- Main path still has unrelated untracked file: `docs/specs/phase-04a-admin-config-prototype.md`; do not touch it from this worktree.

## File Structure

Create focused frontend modules:

- `src/frontend/types/adminConfig.ts`
  - Admin tab ids, status labels, drawer modes, form draft types, UI-only filter state.
- `src/frontend/services/adminConfigApi.ts`
  - Service functions with realistic admin-config names that call existing real API client methods.
  - Always inject `updatedBy: "demo-admin"` or `handlerName: "demo-admin"` where applicable.
- `src/frontend/pages/AdminConfig/AdminConfigPage.tsx`
  - Owns tab routing, loading error display, search/filter state, and passes data/service handlers to tabs.
- `src/frontend/pages/AdminConfig/OverviewTab.tsx`
- `src/frontend/pages/AdminConfig/RolePackagesTab.tsx`
- `src/frontend/pages/AdminConfig/D1GuideTab.tsx`
- `src/frontend/pages/AdminConfig/WeeklyFeedbackTab.tsx`
- `src/frontend/pages/AdminConfig/AnonymousConfigTab.tsx`
- `src/frontend/pages/AdminConfig/KnowledgeTab.tsx`
- `src/frontend/pages/AdminConfig/FeedbackPoolTab.tsx`

Create shared admin-config components:

- `src/frontend/components/admin-config/AdminConfigLayout.tsx`
- `src/frontend/components/admin-config/AdminSidebar.tsx`
- `src/frontend/components/admin-config/AdminTopbar.tsx`
- `src/frontend/components/admin-config/MetricCard.tsx`
- `src/frontend/components/admin-config/StatusTag.tsx`
- `src/frontend/components/admin-config/DataTable.tsx`
- `src/frontend/components/admin-config/RightDrawer.tsx`
- `src/frontend/components/admin-config/UploadKnowledgeModal.tsx`
- `src/frontend/components/admin-config/FieldError.tsx`

Modify existing files:

- `src/frontend/AppContent.tsx`
  - Replace import/use of old `AdminPage` with new `AdminConfigPage`.
- `src/frontend/pages/adminPages.tsx`
  - Keep `ReviewPage` here initially; remove or stop exporting the old monolithic `AdminPage`.
- `src/frontend/routes.ts`
  - Keep Page 08 route at `/admin-config`.
  - Keep Page 09 `/review`.
  - Do not add `/admin/workbench`, `/admin/newcomers`, `/admin/review`, `/admin/roles-audit`, or `/admin/permission-routes`.
- `src/frontend/styles.css`
  - Add desktop admin workbench styles based on prototype: fixed left sidebar, top filter bar, cards, tables, right drawer, modal.

Add/modify tests:

- `tests/phase04a-admin-config-workbench.test.ts`
  - Static structure tests for route tabs, forbidden routes/copy, no delete semantics, fixed user, and service-layer usage.
- Extend `tests/frontend-architecture.test.ts`
  - Assert admin modules do not call `fetch` directly and use `adminConfigApi`.
- Extend `tests/phase04a-admin-config.test.ts` only if backend gaps are discovered while implementing UI.

---

### Task 1: Lock Admin Tab Contract And Route Mapping

**Files:**
- Create: `src/frontend/types/adminConfig.ts`
- Test: `tests/phase04a-admin-config-workbench.test.ts`

- [ ] **Step 1: Write the failing contract test**

Add this test file:

```ts
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
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm.cmd test -- tests/phase04a-admin-config-workbench.test.ts
```

Expected: fails because `src/frontend/types/adminConfig.ts` does not exist.

- [ ] **Step 3: Implement the contract file**

Create `src/frontend/types/adminConfig.ts`:

```ts
export const currentAdminUser = {
  name: 'demo-admin',
  role: '后台管理员',
} as const;

export type AdminConfigTabId =
  | 'overview'
  | 'role-packages'
  | 'd1-guide'
  | 'weekly-feedback'
  | 'anonymous-config'
  | 'knowledge'
  | 'feedback-pool';

export type AdminConfigTab = {
  id: AdminConfigTabId;
  label: string;
  path: string;
};

export const adminConfigTabs: AdminConfigTab[] = [
  { id: 'overview', label: '配置总览', path: '/admin-config?tab=overview' },
  { id: 'role-packages', label: '岗位权限包', path: '/admin-config?tab=role-packages' },
  { id: 'd1-guide', label: 'D1 引导配置', path: '/admin-config?tab=d1-guide' },
  { id: 'weekly-feedback', label: '首周反馈表', path: '/admin-config?tab=weekly-feedback' },
  { id: 'anonymous-config', label: '匿名反馈配置', path: '/admin-config?tab=anonymous-config' },
  { id: 'knowledge', label: '知识库管理', path: '/admin-config?tab=knowledge' },
  { id: 'feedback-pool', label: '匿名反馈池', path: '/admin-config?tab=feedback-pool' },
];

export function resolveAdminConfigTab(search: string): AdminConfigTabId {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  if (tab === 'feedback') return 'feedback-pool';
  if (tab === 'knowledge') return 'knowledge';
  if (adminConfigTabs.some((item) => item.id === tab)) return tab as AdminConfigTabId;
  return 'overview';
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```powershell
npm.cmd test -- tests/phase04a-admin-config-workbench.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add src/frontend/types/adminConfig.ts tests/phase04a-admin-config-workbench.test.ts
git commit -m "feat: define admin config workbench contract"
```

---

### Task 2: Add Service Layer Over The Real API Client

**Files:**
- Create: `src/frontend/services/adminConfigApi.ts`
- Modify: `src/frontend/api.ts`
- Test: `tests/phase04a-admin-config-workbench.test.ts`

- [ ] **Step 1: Add failing service-layer tests**

Extend `tests/phase04a-admin-config-workbench.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm.cmd test -- tests/phase04a-admin-config-workbench.test.ts
```

Expected: fails because `adminConfigApi.ts` does not exist.

- [ ] **Step 3: Export narrow helpers from `api.ts` if needed**

Keep existing `requestApi` private. Use the existing exported `api` methods first. If a method lacks a field from the UI, extend only its body type, not the transport.

For example, extend `api.updateWeeklyFeedbackConfig` body to include `description`, `required`, `maxLength`, `enabled`, and option `enabled`:

```ts
updateWeeklyFeedbackConfig: (
  questions: Array<{
    id: string;
    title: string;
    description?: string | null;
    required?: boolean;
    maxLength?: number | null;
    enabled?: boolean;
    options?: Array<{ id: string; label: string; enabled?: boolean }>;
  }>,
) => apiSend<WeeklyFeedbackConfig>('/api/admin/weekly-feedback-config', 'PATCH', { questions }),
```

- [ ] **Step 4: Create `adminConfigApi.ts`**

Implement service functions with names matching the intended real API surface:

```ts
import { api, type AnonymousFeedback, type D1GuideConfigItem, type KnowledgeDoc, type PermissionItem, type WeeklyFeedbackQuestion } from '../api.ts';
import { currentAdminUser } from '../types/adminConfig.ts';

export function getAdminOverviewData() {
  return api.getAdminConfig();
}

export function saveRolePackagePermission(id: string, draft: Partial<PermissionItem>) {
  return api.updatePermissionItem(id, { ...draft, updatedBy: currentAdminUser.name } as Partial<PermissionItem>);
}

export function createPermissionForRole(roleId: string, draft: Omit<PermissionItem, 'id' | 'sensitive'>) {
  return api.createPermissionItem({ ...draft, updatedBy: currentAdminUser.name } as Parameters<typeof api.createPermissionItem>[0]).then(async (created) => {
    await api.createRolePermissionItem({ roleId, permissionItemId: created.id });
    return created;
  });
}

export function saveD1GuideItem(item: Partial<D1GuideConfigItem> & { actionKey: string }) {
  return api.updateD1GuideConfig([{ ...item, updatedBy: currentAdminUser.name }]);
}

export function saveWeeklyFeedbackQuestion(question: WeeklyFeedbackQuestion) {
  return api.updateWeeklyFeedbackConfig([
    {
      id: question.id,
      title: question.title,
      description: question.description ?? null,
      required: question.required,
      maxLength: question.maxLength ?? null,
      enabled: question.enabled,
      options: question.options.map((option) => ({ id: option.id, label: option.label, enabled: option.enabled })),
    },
  ]);
}

export function saveAnonymousFeedbackConfig(body: Parameters<typeof api.updateAnonymousFeedbackConfig>[0]) {
  return api.updateAnonymousFeedbackConfig(body);
}

export function uploadKnowledgeMetadata(body: Pick<KnowledgeDoc, 'title' | 'category' | 'applicableRole' | 'applicableStage' | 'ownerName'> & { sourceUrl?: string }) {
  return api.createKnowledgeDoc({
    ...body,
    sourceUrl: body.sourceUrl ?? 'mock-drive://admin-upload',
  });
}

export function processAnonymousFeedback(id: string, body: Pick<AnonymousFeedback, 'status' | 'ownerName' | 'result' | 'resolutionNote' | 'includedInReview'>) {
  return api.updateAnonymousFeedback(id, {
    ...body,
    handlerName: currentAdminUser.name,
  });
}
```

- [ ] **Step 5: Run targeted tests**

Run:

```powershell
npm.cmd test -- tests/phase04a-admin-config-workbench.test.ts tests/frontend-api-client.test.ts tests/phase04a-admin-config.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add src/frontend/api.ts src/frontend/services/adminConfigApi.ts tests/phase04a-admin-config-workbench.test.ts
git commit -m "feat: add admin config service layer"
```

---

### Task 3: Build Desktop Admin Layout Shell

**Files:**
- Create:
  - `src/frontend/components/admin-config/AdminConfigLayout.tsx`
  - `src/frontend/components/admin-config/AdminSidebar.tsx`
  - `src/frontend/components/admin-config/AdminTopbar.tsx`
  - `src/frontend/pages/AdminConfig/AdminConfigPage.tsx`
- Modify:
  - `src/frontend/AppContent.tsx`
  - `src/frontend/pages/adminPages.tsx`
  - `src/frontend/styles.css`
- Test:
  - `tests/phase04a-admin-config-workbench.test.ts`

- [ ] **Step 1: Add failing layout tests**

Add:

```ts
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm.cmd test -- tests/phase04a-admin-config-workbench.test.ts
```

Expected: fails because layout files do not exist.

- [ ] **Step 3: Implement `AdminSidebar`**

Use `adminConfigTabs`; no extra navigation items. Use button navigation to `/admin-config?tab=<id>`.

- [ ] **Step 4: Implement `AdminTopbar`**

Use controlled inputs/selects locally. Filters affect only current tab arrays. Keep date fixed to `2026-06-23`.

- [ ] **Step 5: Implement `AdminConfigLayout`**

Composition:

```tsx
<div className="admin-workbench">
  <AdminSidebar activeTab={activeTab} navigate={navigate} />
  <main className="admin-workbench-main">
    <AdminTopbar filters={filters} onFiltersChange={setFilters} reload={reload} />
    <section className="admin-workbench-content">{children}</section>
  </main>
</div>
```

- [ ] **Step 6: Wire `AdminConfigPage` into `AppContent`**

In `AppContent.tsx`, replace:

```tsx
import { AdminPage, ReviewPage } from './pages/adminPages.tsx';
```

with:

```tsx
import { AdminConfigPage } from './pages/AdminConfig/AdminConfigPage.tsx';
import { ReviewPage } from './pages/adminPages.tsx';
```

Then page 08 returns:

```tsx
return <AdminConfigPage data={data} search={search} toast={toast} reload={reload} navigate={navigate} />;
```

- [ ] **Step 7: Add CSS for desktop workbench**

Add prefixed classes: `.admin-workbench`, `.admin-workbench-sidebar`, `.admin-workbench-topbar`, `.admin-workbench-content`, `.admin-table`, `.admin-drawer`, `.admin-modal`.

Keep cards radius at `8px` or less to match the desktop tool style.

- [ ] **Step 8: Run tests and build**

Run:

```powershell
npm.cmd test -- tests/phase04a-admin-config-workbench.test.ts tests/phase-shell-separation.test.ts
npm.cmd run build
```

Expected: both pass.

- [ ] **Step 9: Commit**

```powershell
git add src/frontend/AppContent.tsx src/frontend/pages/adminPages.tsx src/frontend/pages/AdminConfig src/frontend/components/admin-config src/frontend/styles.css tests/phase04a-admin-config-workbench.test.ts
git commit -m "feat: add admin config desktop workbench shell"
```

---

### Task 4: Implement Overview Tab

**Files:**
- Create:
  - `src/frontend/components/admin-config/MetricCard.tsx`
  - `src/frontend/components/admin-config/StatusTag.tsx`
  - `src/frontend/pages/AdminConfig/OverviewTab.tsx`
- Modify:
  - `src/frontend/pages/AdminConfig/AdminConfigPage.tsx`
  - `src/frontend/styles.css`
- Test:
  - `tests/phase04a-admin-config-workbench.test.ts`

- [ ] **Step 1: Add failing overview tests**

Add tests asserting `OverviewTab.tsx` contains:

```ts
for (const label of ['岗位数', '权限项数', '知识库资料数', '待处理匿名反馈数', '配置完整度', '待处理事项', '最近变更记录', '快捷操作']) {
  assert.match(overview, new RegExp(label));
}
for (const quickAction of ['新增权限项', '新增岗位', '设置 D1 引导', '新增反馈问题', '上传知识库资料', '查看反馈池']) {
  assert.match(overview, new RegExp(quickAction));
}
```

- [ ] **Step 2: Implement `MetricCard` and `StatusTag`**

Keep them presentational and reusable by all tabs.

- [ ] **Step 3: Implement `OverviewTab`**

Compute metrics from `DashboardData`:

- roles count: `data.admin?.roles.length ?? 0`
- permission items count: `data.admin?.permissionItems.length ?? 0`
- knowledge docs count: `data.knowledgeDocs?.length ?? 0`
- pending anonymous feedback count: statuses `pending`, `open`, `in_progress`

Use generated recent changes from `updatedBy` and `updatedAt` where present; do not create a fake persisted audit table.

- [ ] **Step 4: Wire quick actions to tabs**

Quick actions navigate within `/admin-config` only. Example: `上传知识库资料` navigates to `/admin-config?tab=knowledge`.

- [ ] **Step 5: Verify**

Run:

```powershell
npm.cmd test -- tests/phase04a-admin-config-workbench.test.ts
npm.cmd run build
```

- [ ] **Step 6: Commit**

```powershell
git add src/frontend/components/admin-config src/frontend/pages/AdminConfig src/frontend/styles.css tests/phase04a-admin-config-workbench.test.ts
git commit -m "feat: add admin config overview tab"
```

---

### Task 5: Implement Role Permission Packages Tab

**Files:**
- Create:
  - `src/frontend/components/admin-config/DataTable.tsx`
  - `src/frontend/components/admin-config/RightDrawer.tsx`
  - `src/frontend/components/admin-config/FieldError.tsx`
  - `src/frontend/pages/AdminConfig/RolePackagesTab.tsx`
- Modify:
  - `src/frontend/pages/AdminConfig/AdminConfigPage.tsx`
  - `src/frontend/styles.css`
- Test:
  - `tests/phase04a-admin-config-workbench.test.ts`
  - `tests/phase04a-admin-config.test.ts` only if API fields are missing.

- [ ] **Step 1: Add failing static tests**

Assert role package UI includes exact fields:

```ts
for (const label of ['权限名称', '所属分类', '权限类型', 'Owner 类型', 'Owner 名称', 'Owner 联系方式', '申请入口名称', '申请入口 URL', '审批人', '理由模板', '常见等待原因', '启用状态']) {
  assert.match(roleTab, new RegExp(label));
}
assert.equal(roleTab.includes('删除'), false);
assert.match(roleTab, /停用/);
```

- [ ] **Step 2: Verify backend field gap**

Current backend `PermissionItem` has `name` and `applyUrl`, but the user requires distinct:

- `permissionName`
- `applyEntryName`
- `applyEntryUrl`

Implement frontend labels as:

- 权限名称 maps to `PermissionItem.name`
- 申请入口 URL maps to `PermissionItem.applyUrl`

If the database already has no `applyEntryName`, add `applyEntryName` to `permission_items` migration and seed; otherwise use `name` as initial `applyEntryName` only in the UI draft and persist once backend supports it.

- [ ] **Step 3: Implement drawer form validation**

Field-level validation before save:

- required strings non-empty
- URL starts with `mock-feishu://`, `http://`, or `https://`
- waiting reasons split by line

Server remains final authority; display `formatApiErrorMessage(error)` near the drawer field group.

- [ ] **Step 4: Implement table filters**

Search current tab list by permission name, apply entry name, approver, owner. Status filter maps to `enabled`.

- [ ] **Step 5: Save through `adminConfigApi.saveRolePackagePermission`**

No direct `api.updatePermissionItem` inside the component.

- [ ] **Step 6: Verify newcomer impact**

Manual smoke after implementation:

1. Open `/admin-config?tab=role-packages`.
2. Disable an enabled optional permission.
3. Refresh `/admin-config?tab=role-packages`; disabled status remains.
4. Open `/permissions`; disabled permission does not show for new package display.
5. Existing `/permission-detail/:id` or progress rows do not crash for historical ids.

- [ ] **Step 7: Commit**

```powershell
git add src/frontend/components/admin-config src/frontend/pages/AdminConfig src/frontend/styles.css tests/phase04a-admin-config-workbench.test.ts
git commit -m "feat: add role permission package workbench"
```

---

### Task 6: Implement D1 Guide Tab

**Files:**
- Create: `src/frontend/pages/AdminConfig/D1GuideTab.tsx`
- Modify:
  - `src/frontend/pages/AdminConfig/AdminConfigPage.tsx`
  - `src/frontend/styles.css`
- Test: `tests/phase04a-admin-config-workbench.test.ts`

- [ ] **Step 1: Add failing D1 tests**

Assert the component contains:

- `D1 引导配置`
- `加入飞书部门群`
- `查看员工指南册`
- `打开岗位权限包`
- `编辑 / 停用`
- no `删除`
- `/permissions`

- [ ] **Step 2: Implement fixed 3-row table**

Use `data.d1GuideConfig` or `data.admin?.d1GuideConfig`; never allow adding or deleting rows.

- [ ] **Step 3: Implement right drawer by action key**

Fields:

- common: title, description, label, ownerName, enabled
- join group: targetGroupName, applyUrl, sendToEmployeeName, sendToEmployeeContact
- employee guide: documentTitle, documentUrl
- permission package: routePath fixed read-only `/permissions`

- [ ] **Step 4: Save one item through service**

Use `adminConfigApi.saveD1GuideItem`.

- [ ] **Step 5: Verify newcomer impact**

1. Change join group title.
2. Save.
3. Refresh admin tab.
4. Open `/d1`; changed title appears.

- [ ] **Step 6: Commit**

```powershell
git add src/frontend/pages/AdminConfig/D1GuideTab.tsx src/frontend/pages/AdminConfig/AdminConfigPage.tsx src/frontend/styles.css tests/phase04a-admin-config-workbench.test.ts
git commit -m "feat: add d1 guide config workbench"
```

---

### Task 7: Implement Weekly Feedback Config Tab

**Files:**
- Create: `src/frontend/pages/AdminConfig/WeeklyFeedbackTab.tsx`
- Modify:
  - `src/frontend/api.ts`
  - `src/frontend/services/adminConfigApi.ts`
  - `src/frontend/pages/AdminConfig/AdminConfigPage.tsx`
  - `src/frontend/styles.css`
- Test:
  - `tests/phase04a-admin-config-workbench.test.ts`
  - `tests/phase04a-admin-config.test.ts`

- [ ] **Step 1: Add failing weekly UI tests**

Assert fields:

- 问题标题
- 问题说明
- 输入类型
- 是否必填
- 最大字数
- 选项列表
- 问题启用状态
- 编辑 / 复制 / 停用
- no 删除

- [ ] **Step 2: Keep backend guardrails**

Existing API already rejects disabling all questions. Add backend test only if option-enabled validation is missing:

```ts
it('rejects choice questions with no enabled options', async () => {
  const config = await requestJson<{ data: { questions: Array<{ id: string; inputType: string; options: Array<{ id: string }> }> } }>('/api/weekly-feedback-config');
  const choice = config.body.data.questions.find((question) => question.inputType !== 'text' && question.options.length > 0)!;
  const response = await requestJson<{ error: string }>('/api/admin/weekly-feedback-config', {
    method: 'PATCH',
    body: JSON.stringify({
      questions: [{ id: choice.id, title: choice.id, enabled: true, options: choice.options.map((option) => ({ id: option.id, label: option.id, enabled: false })) }],
    }),
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /option/i);
});
```

- [ ] **Step 3: Implement table and drawer**

Copy creates a draft client-side question row only if backend create endpoint exists. If backend create is missing, postpone actual copy persistence and label the button as simulated disabled with tooltip until a create endpoint is added.

- [ ] **Step 4: Save through service**

Use `saveWeeklyFeedbackQuestion`.

- [ ] **Step 5: Verify newcomer impact**

Change a question title; save; refresh; open `/weekly-feedback`; title appears. Disable one question; `/weekly-feedback` hides it; historical manager feedback remains unaffected.

- [ ] **Step 6: Commit**

```powershell
git add src/frontend/api.ts src/frontend/services/adminConfigApi.ts src/frontend/pages/AdminConfig/WeeklyFeedbackTab.tsx src/frontend/pages/AdminConfig/AdminConfigPage.tsx src/frontend/styles.css tests/phase04a-admin-config-workbench.test.ts tests/phase04a-admin-config.test.ts
git commit -m "feat: add weekly feedback config workbench"
```

---

### Task 8: Implement Anonymous Feedback Config Tab

**Files:**
- Create: `src/frontend/pages/AdminConfig/AnonymousConfigTab.tsx`
- Modify:
  - `src/frontend/pages/AdminConfig/AdminConfigPage.tsx`
  - `src/frontend/styles.css`
- Test:
  - `tests/phase04a-admin-config-workbench.test.ts`
  - `tests/phase04a-admin-config.test.ts`

- [ ] **Step 1: Add failing anonymous config UI tests**

Assert:

- `反馈模块列表`
- `当前模块`
- `问题类型`
- `希望如何处理`
- `typeKey`
- `actionKey`
- `是否需要补充文本`
- no `删除`

- [ ] **Step 2: Implement left module list and right detail**

Match prototype 5: left module table, right detail panels. Selecting a module only changes local selected id.

- [ ] **Step 3: Implement inline edits and switches**

Use service `saveAnonymousFeedbackConfig` to update:

- module labels/enabled
- problem type labels/requiresText/enabled
- expected action labels/requiresText/enabled

- [ ] **Step 4: Preserve backend validation**

Existing tests cover invalid references. If duplicate `typeKey` or `actionKey` is not covered by backend, add tests and validation before UI completion.

- [ ] **Step 5: Verify newcomer impact**

Change a problem type label; save; refresh; open `/anonymous-feedback`; label appears in the second-level choice. Disable a module; newcomer page no longer shows it; existing feedback pool still shows old feedback.

- [ ] **Step 6: Commit**

```powershell
git add src/frontend/pages/AdminConfig/AnonymousConfigTab.tsx src/frontend/pages/AdminConfig/AdminConfigPage.tsx src/frontend/styles.css tests/phase04a-admin-config-workbench.test.ts tests/phase04a-admin-config.test.ts
git commit -m "feat: add anonymous feedback config workbench"
```

---

### Task 9: Implement Knowledge Management Tab

**Files:**
- Create:
  - `src/frontend/components/admin-config/UploadKnowledgeModal.tsx`
  - `src/frontend/pages/AdminConfig/KnowledgeTab.tsx`
- Modify:
  - `src/frontend/pages/AdminConfig/AdminConfigPage.tsx`
  - `src/frontend/styles.css`
- Test:
  - `tests/phase04a-admin-config-workbench.test.ts`

- [ ] **Step 1: Add failing knowledge UI tests**

Assert:

- `知识库管理`
- `上传知识库资料`
- `知识库上传窗口`
- `文件选择`
- `开始上传`
- `解析和向量化仍为模拟状态`
- no real upload/vector/RAG wording that implies integration.

- [ ] **Step 2: Implement table**

Columns:

- 文档名称
- 知识分类
- 适用岗位
- 适用阶段
- Owner
- 状态
- 解析状态
- 向量化状态
- 命中次数
- updatedBy
- updatedAt
- 操作

- [ ] **Step 3: Implement upload modal**

Mock file selector is local UI only. Required fields are document title, category, role, stage, owner. Source defaults to `mock-drive://admin-upload`.

- [ ] **Step 4: Save through service**

Use `uploadKnowledgeMetadata`; toast exact text:

```text
已保存知识库资料元数据，解析和向量化仍为模拟状态
```

- [ ] **Step 5: Verify persistence**

Upload a metadata row, refresh `/admin-config?tab=knowledge`, confirm it remains. Open `/review`, confirm knowledge doc count reflects DB.

- [ ] **Step 6: Commit**

```powershell
git add src/frontend/components/admin-config/UploadKnowledgeModal.tsx src/frontend/pages/AdminConfig/KnowledgeTab.tsx src/frontend/pages/AdminConfig/AdminConfigPage.tsx src/frontend/styles.css tests/phase04a-admin-config-workbench.test.ts
git commit -m "feat: add knowledge metadata workbench"
```

---

### Task 10: Implement Anonymous Feedback Pool Tab

**Files:**
- Create: `src/frontend/pages/AdminConfig/FeedbackPoolTab.tsx`
- Modify:
  - `src/frontend/pages/AdminConfig/AdminConfigPage.tsx`
  - `src/frontend/styles.css`
- Test:
  - `tests/phase04a-admin-config-workbench.test.ts`
  - `tests/phase04a-admin-config.test.ts`

- [ ] **Step 1: Add failing feedback pool UI tests**

Assert:

- statuses: 待处理, 处理中, 已补充知识库, 已修正权限入口, 暂不处理, 已关闭
- internal values in code: pending, in_progress, knowledge_added, permission_entry_fixed, deferred, closed
- compatibility copy: open / resolved / archived
- drawer fields: handlerName, handledAt, resolutionNote, includedInReview
- no manager-facing anonymous raw text path.

- [ ] **Step 2: Implement status filters and table**

Match prototype 7 status tabs. Display raw anonymous feedback text only inside this admin tab.

- [ ] **Step 3: Implement process drawer**

Read-only fields:

- feedbackNo
- type
- module
- description
- isAnonymous
- expectedAction

Editable fields:

- ownerName
- status
- result
- resolutionNote
- includedInReview

Derived fields:

- handlerName = demo-admin
- handledAt generated by backend after save

- [ ] **Step 4: Save through service**

Use `processAnonymousFeedback`.

- [ ] **Step 5: Verify manager boundary**

Search manager pages to confirm they do not render `anonymous`, `anonymousFeedbacks`, or `description` from anonymous feedback data. Add a static test if needed.

- [ ] **Step 6: Verify review impact**

Set `includedInReview = true`, save, refresh. Open `/review`; anonymous feedback type stats should still load from backend data and not crash.

- [ ] **Step 7: Commit**

```powershell
git add src/frontend/pages/AdminConfig/FeedbackPoolTab.tsx src/frontend/pages/AdminConfig/AdminConfigPage.tsx src/frontend/styles.css tests/phase04a-admin-config-workbench.test.ts tests/phase04a-admin-config.test.ts
git commit -m "feat: add anonymous feedback pool workbench"
```

---

### Task 11: Final Cross-Route Verification

**Files:**
- Modify only if verification exposes bugs.

- [ ] **Step 1: Run full automated checks**

Run:

```powershell
npm.cmd test
npm.cmd run build
```

Expected:

- tests pass
- build passes

- [ ] **Step 2: Start local services**

Run API and frontend from this worktree:

```powershell
Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('src/server/index.ts') -WorkingDirectory 'C:\Users\HDL\Documents\海纳入职Bot开发\.worktrees\phase-04a-admin-config-workbench' -WindowStyle Hidden
Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1') -WorkingDirectory 'C:\Users\HDL\Documents\海纳入职Bot开发\.worktrees\phase-04a-admin-config-workbench' -WindowStyle Hidden
```

- [ ] **Step 3: Browser smoke routes**

Verify:

- `/admin-config`
- `/admin-config?tab=overview`
- `/admin-config?tab=role-packages`
- `/admin-config?tab=d1-guide`
- `/admin-config?tab=weekly-feedback`
- `/admin-config?tab=anonymous-config`
- `/admin-config?tab=knowledge`
- `/admin-config?tab=feedback-pool`
- `/d1`
- `/permissions`
- `/weekly-feedback`
- `/anonymous-feedback`
- `/review`

- [ ] **Step 4: Persistence smoke**

Use real UI where possible:

1. Save D1 title in admin, refresh admin, open `/d1`.
2. Disable one permission, refresh admin, open `/permissions`.
3. Change one weekly question, refresh admin, open `/weekly-feedback`.
4. Change one anonymous problem type, refresh admin, open `/anonymous-feedback`.
5. Upload one knowledge metadata row, refresh admin, open `/review`.
6. Process one anonymous feedback, refresh admin, open `/review`.

- [ ] **Step 5: Final status report**

Report:

- branch and worktree path
- commits made
- `npm.cmd test` result
- `npm.cmd run build` result
- browser smoke result
- known limitations or follow-up bugs

---

## Self-Review

Spec coverage:

- 7 `/admin-config` tabs are covered by Tasks 1 and 4-10.
- Fixed sidebar and topbar are covered by Task 3.
- No physical delete is covered by static tests and tab implementations.
- Service-layer saves are covered by Task 2 and component implementation rules.
- P0 backend persistence is preserved by using existing real API and DB.
- Newcomer/review read-through is covered by each module's verification and final smoke.

Known implementation risk:

- `PermissionItem` currently does not fully separate `permissionName`, `applyEntryName`, and `applyEntryUrl`. Task 5 requires checking whether to add `applyEntryName` to backend schema or keep it as a UI-only label until persisted support is added. Business rule prefers persisted separation.
- Existing backend already supports many Phase 04A validations, but weekly option “at least one enabled option” and anonymous duplicate keys may need additional tests before UI completion.
