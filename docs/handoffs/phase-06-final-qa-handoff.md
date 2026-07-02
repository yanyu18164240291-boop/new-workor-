# 海纳 AI 入职 Bot H5 Phase 06 交接摘要

更新时间：2026-07-02  
当前工作树：`C:\Users\HDL\Documents\海纳入职Bot开发\.worktrees\phase-05-manager-flow`  
当前分支：`codex/phase-05-manager-flow`  
master 状态：未直接污染 master  
当前工作树状态：提交本文档前为干净状态

## 最新提交

- `ce339d5 fix: harden manager flow boundaries`
- `2502996 feat: implement manager feedback workflow`
- Phase 05 基线前提交：`45cc5db feat: tighten review closeout summary`

## 当前阶段

Phase 05 管理者端已收口。

下一步进入：`docs/specs/phase-06-final-qa.md`

Phase 06 目标是全应用最终 QA：12 个页面、路由、刷新持久化、移动端视觉、P0 后端数据闭环、权限边界、禁区能力和交付一致性检查。

## 关键产品决策

1. P0 数据必须走真实后端和 SQLite，不允许只用前端状态模拟。
2. 不接真实登录、飞书、审批、RAG、上传、消息发送；这些只允许 mock 行为。
3. Page 06 是实名首周反馈，写给管理者。
4. Page 07 是匿名流程反馈，不向管理者暴露原文。
5. Page 12 是管理者只读查看 Page 06 首周反馈，不是评价页。
6. 管理端只做入职支持和跟进，不做绩效评价、能力评分、排名。
7. 用户后续明确覆盖了 Phase 05 原始规格：
   - 管理端底栏去掉“我的”和“反馈”，目前只保留“总览 / 新人”。
   - Page 10 标题从“管理者”改为“入职管理”。
   - Page 10 名单改为“周内到岗名单”。
   - Page 10 新人卡片去掉“权限待跟进 / 进展正常 / 查看首周详情”，改为整卡点击和三角标识。
   - Page 11 删除管理者侧旧的完成情况、阻塞、管理建议等模块，改为同步新人端 Page 06 首周反馈内容快照。

## 已完成部分

### Phase 00-04 已有能力

- 后端 schema、迁移、seed 数据可用。
- 新人端首页、D1 引导、岗位权限包、权限详情、4 小时回访已接后端。
- 权限进度写入 `permission_progress`。
- 4 小时回访写入 `follow_up_tasks`。
- 匿名反馈写入 `anonymous_feedbacks`。
- 首周反馈写入 `weekly_feedbacks` 和结构化 answers。
- 后台配置台可维护岗位、权限、D1 引导、首周反馈配置、匿名反馈配置、知识库元数据。
- V1 复盘页读取真实后端数据，不暴露匿名反馈原文。

### Phase 05 已完成

- `/manager` 管理端总览页。
- `/manager/newcomer/:id` 新人首周跟踪详情。
- `/manager/feedback/:id` 管理者视角首周反馈只读页。
- 新增 `src/server/repositories/managerRepository.ts`，管理端查询集中到 Repository。
- `managerService.ts` 负责管理者范围、D1-D7 阶段计算、状态聚合、返回前端所需 DTO。
- 管理端 API 已接真实后端：
  - `GET /api/manager/overview`
  - `GET /api/manager/newcomer/:id`
  - `GET /api/manager/feedback/:id`
  - `PATCH /api/manager/feedback/:id/action`
- 管理端权限边界已加强：
  - `/api/manager/*` 必须带 `x-haina-role: manager`
  - actor 仅允许 `demo-manager` / `demo-other-manager`
  - 不再对未知 actor 默认落到刘长省数据。
- 管理者横向越权已测试：
  - `demo-other-manager` 访问刘长省名下新人/反馈返回 404。
- Page 10 岗位统计同步后台启用岗位：
  - 后台停用岗位后，管理端岗位统计不展示。
  - 岗位名称直接使用后台配置名称，不再前端硬编码“产品岗”。
- Page 10 新人列表按飞书入群时间计算 D1-D7：
  - 基于 `newcomer_task_states.taskKey = 'join_feishu_org'` 的 `completedAt`。
  - D8 起不出现在“周内到岗名单”。
  - 顶部人数、岗位统计、列表已统一使用同一份 D1-D7 可见集合。
- 演示 seed 暂时将：
  - 燕余设为 D7。
  - 崔令飞设为 D1。
- Page 11 同步 Page 06 首周反馈字段：
  - 首周工作摘要。
  - 首周整体感受。
  - 当前主要卡点。
  - 希望管理者提供的支持。
  - 新人想说的话。
- 修复 Page 06 多个 text 问题共用同一个 state 的问题，改为按 question 存文本。
- 兼容旧库：
  - 补 `join_feishu_org` task。
  - 补首周工作摘要 question/answer。
  - 补缺失的 `manager_feedback_actions`，避免旧库已有 `weekly_feedbacks` 但管理端操作 404。
- 管理端底栏布局已调整为两项，视觉均衡。

## 当前验证状态

最近已验证：

- `npm.cmd test`
  - 102 个测试通过
  - 0 失败
- `npm.cmd run build`
  - TypeScript 编译通过
  - Vite build 通过
- `git diff --check`
  - 通过
- 当前工作树干净。

## 重要文件修改记录

### 前端

- `src/frontend/routes.ts`
  - 维护 12 个页面 route/page number/title。
  - 管理端底栏现在为“总览 / 新人”两项。
- `src/frontend/App.tsx`
  - 管理端底部导航跳转逻辑。
  - Page 10/11/12 页面渲染入口。
- `src/frontend/appState.ts`
  - 按页面加载后端数据。
  - 管理端数据从 `api.getManagerOverview` / `api.getManagerNewcomerDetail` / `api.getManagerFeedback` 加载。
- `src/frontend/api.ts`
  - 前端 API client 和类型定义。
  - 管理端请求自动带 demo manager header。
  - 定义 `ManagerOverview`、`ManagerNewcomerDetail` 等类型。
- `src/frontend/pages/managerPages.tsx`
  - Page 10、11、12 主要 UI。
  - Page 10：入职管理、今日新员工、岗位统计、周内到岗名单。
  - Page 11：新人详情 + 首周反馈快照。
  - Page 12：首周反馈只读查看 + manager action。
- `src/frontend/pages/newcomerPages.tsx`
  - Page 06 首周反馈填写支持 `work_summary`。
  - 修复多个文本题独立 state。
- `src/frontend/styles.css`
  - 管理端首页、名单卡、底栏、反馈标签视觉样式。
- `src/frontend/pages/AdminConfig/RolePackagesTab.tsx`
  - 岗位启停和岗位同步相关 UI。
- `src/frontend/services/adminConfigApi.ts`
  - 后台岗位新增/同步 API 封装。

### 后端

- `src/server/apiRoutes.ts`
  - 新增 manager API guard。
  - admin 与 manager API 均有明确 demo role guard。
- `src/server/routes/managerRoutes.ts`
  - 注册管理端 API 路由。
- `src/server/services/managerService.ts`
  - 管理端核心服务层。
  - 负责 manager scope、D1-D7 计算、overview 聚合、detail 组装、feedback action 更新。
- `src/server/repositories/managerRepository.ts`
  - 管理端 Repository。
  - 聚合查询 newcomer、role stats、weekly feedback、task states。
- `src/server/services/newcomerService.ts`
  - 首周反馈提交后创建 manager action。
- `src/server/repositories/feedbackRepository.ts`
  - weekly feedback 与 manager action 读取。
- `src/server/seed.ts`
  - demo 数据。
  - D1-D7 动态入群时间。
  - 首周工作摘要 seed/repair。
  - manager feedback action repair。
- `src/server/index.ts`
  - 启动时运行 seed repair。
- `src/server/migrations.ts`
  - 兼容旧库字段补齐。
- `db/migrations/001_initial.sql`
  - 初始 schema、索引、weekly work summary 等字段。

### 测试

- `tests/phase05-manager-flow.test.ts`
  - Phase 05 主测试。
  - 覆盖管理端概览、D1-D7 过滤、岗位启停同步、越权、Page 10/11/12 文案和边界。
- `tests/backend-errors.test.ts`
  - 覆盖 manager API 未授权/未知 actor 返回 403。
- `tests/phase00-api.test.ts`
  - 覆盖 manager action 持久化。
- `tests/phase-nav-separation.test.ts`
  - 覆盖新人/admin/manager 导航隔离。
- `tests/seed-compat.test.ts`
  - 覆盖旧库 repair，包括 join task、weekly work summary、manager action。
- `tests/frontend-architecture.test.ts`
  - 覆盖前端 API 边界和架构约束。

## 架构思路

### 总体分层

- Frontend Pages：只负责渲染和交互。
- API Client：集中 HTTP 请求、错误处理、demo header。
- Routes：只做 URL 到 handler 的映射。
- Service：业务规则和聚合逻辑。
- Repository：SQL 查询封装。
- SQLite：P0 数据真实持久化。

### 管理端数据边界

- 前端不传可信 `manager_id` / `department_id`。
- 后端从 request header 的 demo actor 推导 manager scope。
- 直接改 query 参数不会改变数据范围。
- 未来接真实登录时，应把 `currentManagerName` 替换为 Session/JWT 用户上下文，而不是改前端参数。

### 状态计算

- 新人入职阶段不再信任 `newcomers.stage` 作为唯一来源。
- 管理端 D1-D7 展示基于 `join_feishu_org.completedAt` 计算。
- `newcomers.stage` 只作为 fallback。
- Page 10 D8 后不展示该新人。
- Page 10 统计和列表口径已统一。

### 反馈边界

- Page 06：新人实名首周反馈。
- Page 07：匿名流程反馈。
- Page 11：管理者看新人首周反馈快照。
- Page 12：管理者只读查看完整首周反馈并记录跟进动作。
- 管理端不读取匿名反馈原文。

### 后台配置同步

- 岗位配置以 `roles` 表为准。
- 后台新增/停用岗位后，管理端岗位统计同步。
- 停用岗位不应出现在管理端岗位统计。
- 新人角色名称来自 role 配置，不在前端硬编码。

## Phase 06 待办事项

### 1. 全页面路由 QA

确认 12 个页面全部可进入、可刷新、不白屏：

1. `/`
2. `/d1`
3. `/permissions`
4. `/permission-detail/:id`
5. `/follow-up/:taskId`
6. `/weekly-feedback`
7. `/anonymous-feedback`
8. `/admin-config`
9. `/review`
10. `/manager`
11. `/manager/newcomer/:id`
12. `/manager/feedback/:id`

### 2. 关键交互链路 QA

- Page 01 -> Page 02 -> Page 03。
- Page 03 一键申请后停留 Page 03，并持久化权限进度。
- Page 03 一键申请后产生 `follow_up_tasks`。
- Page 03 查看详情 -> Page 04。
- Page 04 我已提交 -> Page 05。
- 刷新后权限进度和 follow-up 仍存在。
- Page 05 匿名反馈 -> Page 07。
- Page 01 D6/D7 首周反馈入口 -> Page 06 -> submit -> Page 01。
- 刷新后 weekly feedback 仍存在。
- Page 10 新人卡 -> Page 11。
- Page 11/12 首周反馈数据一致。
- Page 12 manager action 后刷新仍保留。
- Page 09 -> Page 08 knowledge / feedback tabs。

### 3. 后端持久化 QA

检查表：

- `roles`
- `permission_items`
- `role_permission_items`
- `newcomers`
- `newcomer_task_states`
- `permission_progress`
- `follow_up_tasks`
- `weekly_feedbacks`
- `weekly_feedback_answers`
- `anonymous_feedbacks`
- `manager_feedback_actions`
- 后台配置相关表

### 4. 安全和边界 QA

- manager API 无 header 返回 403。
- unknown manager actor 返回 403。
- other manager 访问刘长省新人/反馈返回 404。
- admin API 无 admin header 返回 403。
- 管理端不显示匿名反馈原文。
- 管理端不提供绩效评价、能力评分、排名能力。
- 不存在真实 Feishu/approval/RAG/upload/message API 调用。

### 5. 视觉 QA

重点用移动端视口检查：

- 文案不溢出。
- 按钮文字不挤压。
- 底栏不遮挡内容。
- 页面滚动正常。
- 卡片间距统一。
- 状态颜色一致。
- 桌面端 phone shell 居中。
- Page 10/11/12 管理端视觉和当前原型保持一致。

### 6. 交付前技术 QA

建议命令：

```powershell
npm.cmd test
npm.cmd run build
git status --short --branch
git diff --check
```

如果要启动本地：

```powershell
npm.cmd run dev:api
npm.cmd run dev
```

如 `npm.cmd run dev:api` 在 Windows watch/PATH 环境异常，可用：

```powershell
& 'C:\Program Files\nodejs\node.exe' --watch src/server/index.ts
```

## 已知规格差异，需要 Phase 06 记录

Phase 05 原始 spec 写管理端底栏有“总览 / 新人 / 反馈 / 我的”，Page 11 只显示 weekly feedback summary。

但用户后续明确要求：

- 去掉“我的”。
- 去掉底栏“反馈”。
- Page 11 “新人”栏目同步新人端 Page 06 首周反馈内容。
- Page 10 改为“周内到岗名单”，D8 后不展示。
- 删除 Page 10 的状态标签和文字按钮，改为三角进入详情。

当前实现按用户最新指令执行。Phase 06 需要把这个差异作为“用户指令覆盖旧 spec”的交付说明记录下来。

## 给下个新会话的启动提示

```text
请基于当前分支 codex/phase-05-manager-flow 继续做 Phase 06 Final QA。

工作树：
C:\Users\HDL\Documents\海纳入职Bot开发\.worktrees\phase-05-manager-flow

请先阅读：
AGENTS.md
.agents/skills/haina-onboarding-h5/SKILL.md
docs/specs/phase-06-final-qa.md
docs/handoffs/phase-06-final-qa-handoff.md

当前最新提交：
ce339d5 fix: harden manager flow boundaries
2502996 feat: implement manager feedback workflow

目标：
做 12 个页面最终 QA、移动端视觉检查、P0 后端持久化验证、路由/刷新/权限边界/禁区能力检查，并修复发现的问题。
不要直接污染 master。
```
