# Phase 06 Engineering Closeout

更新时间：2026-07-06

本文用于 Phase 06 后的工程收口审计。目标不是继续堆 UI，而是降低后续返工、线上回归和部署混乱的概率。

## 1. 当前结论

当前 H5 MVP 已具备小范围演示和试点准备基础，但还不应被视为开放生产系统。

可以继续推进：

- 老板扫码演示。
- 内部产品评审。
- 可控人员的小范围试点准备。
- Phase 07 部署试点准备。

暂不应推进：

- 真实飞书登录。
- 真实飞书 Bot 消息发送。
- 真实审批提交。
- 真实 RAG / LLM / 向量检索。
- 真实文件上传解析。
- 面向公开网络的无保护生产发布。

## 2. 版本与分支管理

| 项目 | 当前要求 |
|---|---|
| 稳定演示分支 | `codex/render-demo-deploy` |
| 新人端 Bug 修复分支 | `codex/newcomer-home-input-bugfix` |
| 工程收口分支 | `codex/phase-06-engineering-closeout` |
| 当前线上演示提交 | `f64ef8f fix: refine home history typography` |
| 线上演示地址 | https://haina-onboarding-h5-demo.onrender.com |
| master 策略 | 不直接污染；验收后再受控合并 |

后续规则：

1. 所有 Bug 修复先进入独立 `codex/*` 分支。
2. 每次修复必须有测试或文档护栏。
3. 每次上线 Render 后必须记录提交号和线上验证结果。
4. `master` 只接收已验收、可回滚的合并。
5. 如果用户拒绝某个方向，停止在该分支继续叠加，重新从已接受基线开新分支。

## 3. 必跑验证门禁

每次修改后至少运行：

```powershell
npm.cmd test
npm.cmd run build
git diff --check
git status --short --branch
```

涉及移动端视觉、首页、导航或三端入口时，必须补充浏览器检查：

```text
/                       新人首页
/d1                     D1 引导
/permissions            权限申请
/weekly-feedback        首周反馈
/anonymous-feedback     匿名反馈
/admin-config           后台配置台
/review                 试点复盘
/manager                管理端首页
```

## 4. 三端冒烟矩阵

| 端 | 路由 | 必查内容 | 已有自动化护栏 |
|---|---|---|---|
| 新人端 | `/` | 输入框、发送、搜索、历史、加号、推荐问题、进度卡 | `tests/home-chat-model.test.ts`、`tests/frontend-structure.test.ts` |
| 新人端 | `/d1` | D1 引导卡片、路径入口、后端配置读取 | `tests/frontend-structure.test.ts`、`tests/phase00-api.test.ts` |
| 新人端 | `/permissions` | 岗位权限包、后端角色数据、一键申请 | `tests/permission-selection.test.ts`、`tests/phase00-api.test.ts` |
| 新人端 | `/permission-detail/perm-oa` | 权限详情、我已提交、4 小时回访任务 | `tests/phase00-api.test.ts` |
| 新人端 | `/follow-up/follow-up-yanyu-oa` | 回访任务详情、未完成处理 | `tests/phase00-api.test.ts` |
| 新人端 | `/weekly-feedback` | 实名首周反馈、必填校验、提交持久化 | `tests/weekly-feedback-form-model.test.ts`、`tests/phase00-api.test.ts` |
| 新人端 | `/anonymous-feedback` | 匿名反馈、分类配置、提交持久化 | `tests/anonymous-feedback-flow.test.ts`、`tests/phase00-api.test.ts` |
| 后台配置台 | `/admin-config` | 角色、权限、D1、反馈、知识库配置读写 | `tests/phase04a-admin-config.test.ts`、`tests/phase04a-admin-config-workbench.test.ts` |
| 后台配置台 | `/admin-config?tab=knowledge` | 知识库元数据，不做真实解析和向量化 | `tests/phase04a-admin-config.test.ts` |
| 后台配置台 | `/admin-config?tab=feedback` | 匿名反馈池处理，不暴露给管理端 | `tests/phase04a-admin-config.test.ts` |
| 复盘页 | `/review` | 只读复盘、匿名反馈不暴露原文 | `tests/phase04b-review.test.ts` |
| 管理端 | `/manager` | 今日/周内新人、岗位统计、管理范围 | `tests/phase05-manager-flow.test.ts` |
| 管理端 | `/manager/newcomer/newcomer-yanyu` | 新人首周跟踪详情、非绩效视角 | `tests/phase05-manager-flow.test.ts` |
| 管理端 | `/manager/feedback/weekly-yanyu` | Page 06 实名反馈只读、manager action 持久化 | `tests/phase05-manager-flow.test.ts`、`tests/phase00-api.test.ts` |

## 5. P0 数据边界

必须继续保持后端和数据库真实持久化：

| 能力 | 数据边界 |
|---|---|
| 岗位权限包 | 后端 `roles`、`permission_items`、`role_permission_items` |
| 权限进度 | `permission_progress` |
| 4 小时回访 | `follow_up_tasks` |
| 首周反馈 | `weekly_feedbacks`、`weekly_feedback_answers` |
| 匿名反馈 | `anonymous_feedbacks` 及分类明细表 |
| 管理端跟进 | `manager_feedback_actions` |
| 后台配置 | admin service + repository + SQLite，不走浏览器临时状态 |

禁止回退：

- P0 状态只存在 React state。
- 刷新后数据丢失。
- 管理端读取匿名反馈原文。
- 前端直接拼 SQL 或绕开 API client。
- 路由层直接写 SQL，绕过 service/repository。

## 6. 部署与回滚 Runbook

当前 Render 单站演示方式：

| 项目 | 当前值 |
|---|---|
| 服务 | `haina-onboarding-h5-demo` |
| 部署分支 | `codex/render-demo-deploy` |
| 构建命令 | `npm install && npm run build` |
| 启动命令 | `npm start` |
| 健康检查 | `/api/roles` |

本地生产模拟：

```powershell
npm.cmd run build
$env:PORT='4328'
$env:HAINA_DB_PATH='data\pilot-local.db'
npm.cmd start
```

上线前备份 SQLite：

```powershell
Copy-Item -LiteralPath 'data\haina-onboarding.sqlite' -Destination "data\backups\haina-onboarding-$(Get-Date -Format yyyyMMdd-HHmmss).sqlite"
```

回滚代码：

```powershell
git switch codex/render-demo-deploy
git log --oneline -5
git revert <bad_commit_sha>
git push origin codex/render-demo-deploy
```

回滚数据库：

```powershell
Copy-Item -LiteralPath 'data\backups\<backup-file>.sqlite' -Destination 'data\haina-onboarding.sqlite' -Force
```

注意：Render 免费服务的文件系统可能不是持久数据库方案。正式试点前必须确认 SQLite 文件路径、磁盘持久性、备份下载方式和恢复方式。

## 7. 访问控制边界

当前系统仍是 demo guard，不是真登录。

必须保留：

- `/api/admin/*` 和 `/api/admin-config/*` 需要 admin demo header。
- `/api/manager/*` 需要 manager demo header。
- 管理端只看实名首周反馈，不看匿名反馈原文。
- 后台配置台不应被无保护地公开给所有人。

Phase 07 前必须确认：

1. 是否只放内网。
2. 是否增加反向代理访问密码。
3. 谁有后台配置权限。
4. 谁有管理端权限。
5. 谁可以备份和重置数据库。

## 8. 低耦合检查

当前已经存在的正向边界：

- 前端页面和 shell 分离。
- 前端 HTTP 请求集中在 `src/frontend/api.ts`。
- 后端 route / service / repository 分层。
- 后端错误响应统一。
- 管理端数据由后端聚合，不靠前端硬算。

后续如果继续改新人首页，建议优先拆分：

- `HomeChatDock`
- `HomeSearchPanel`
- `HomeHistoryPanel`
- `HomeAttachSheet`
- `HomeProgressCard`

拆分标准：

1. 先有测试覆盖。
2. 每个组件只负责一个面板或一个交互区域。
3. 不在拆分时改视觉设计。
4. 拆分后 `npm.cmd test`、`npm.cmd run build` 必须通过。

## 9. 当前风险与处理顺序

| 风险 | 等级 | 建议 |
|---|---|---|
| 已验收修复尚未沉淀进稳定主线 | 高 | 新人端修复验收后走受控合并或 PR |
| Render 免费实例数据库持久性不确定 | 高 | Phase 07 明确 DB 路径、磁盘、备份恢复 |
| 管理/后台页面公开访问缺少真实认证 | 高 | 试点前至少用网络或反向代理保护 |
| 首页组件继续膨胀 | 中 | 后续功能前先拆组件，不在 Bug 修复中大重构 |
| 视觉问题靠人工截图验收 | 中 | 保留现有结构测试，必要时增加浏览器截图检查 |

## 10. 完成标准

本工程收口完成时必须满足：

- `docs/qa/phase-06-bugfix-ledger.md` 存在并记录已验收 Bugfix。
- 本文档包含版本、门禁、三端冒烟矩阵、P0 数据边界、部署 runbook、访问控制和风险表。
- `tests/phase06-engineering-closeout.test.ts` 覆盖文档完整性。
- `npm.cmd test` 通过。
- `npm.cmd run build` 通过。
- 工作树保持干净，且未污染 `master`。
