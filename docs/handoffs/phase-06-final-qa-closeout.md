# 海纳 AI 入职 Bot H5 Phase 06 最终 QA 交付记录

更新时间：2026-07-03
工作树：`C:\Users\HDL\Documents\海纳入职Bot开发\.worktrees\phase-06-final-qa-master`
分支：`codex/phase-06-final-qa-master`

## 1. 交付结论

Phase 06 已完成最终 QA 收口，当前 MVP 可以进入“可部署试点准备”阶段。

本次收口未扩大产品范围，仍严格保持：

- P0 业务数据走真实 Node 后端和 SQLite。
- 外部飞书、审批、RAG、上传解析、消息发送仍为模拟能力。
- Page 06 是实名首周反馈，供管理者查看。
- Page 07 是匿名流程反馈，不向管理者暴露原文。
- Page 12 是管理者只读查看 Page 06 首周反馈并记录跟进行动。
- 管理者端只支持入职支持和跟进，不提供绩效评价、能力评分、排名。

## 2. 本次实际改动

### 2.1 移动端视觉修复

发现问题：

- 移动端首页底部快捷问题按钮 `ChatGPT账号怎么申请？` 在 390px 宽度下被三列布局压缩，按钮内部文字发生截断。

修复：

- `src/frontend/styles.css`
  - 移除首页 fixed chat quick chip 的 `text-overflow: ellipsis` 与 `white-space: nowrap`。
  - 改为允许中文问题在按钮内自然换行。

回归测试：

- `tests/frontend-structure.test.ts`
  - 新增测试，防止首页 quick question chip 再次用单行截断规则。

## 3. 路由与页面 QA

已用移动端视口做路由冒烟检查，确认以下页面均可进入、非白屏、无后端连接错误、无 console error：

1. `/`
2. `/d1`
3. `/permissions`
4. `/permission-detail/perm-oa`
5. `/follow-up/follow-up-yanyu-oa`
6. `/weekly-feedback`
7. `/anonymous-feedback`
8. `/admin-config`
9. `/review`
10. `/manager`
11. `/manager/newcomer/newcomer-yanyu`
12. `/manager/feedback/weekly-yanyu`

同时检查：

- `/admin-config?tab=knowledge`
- `/admin-config?tab=feedback`

## 4. 写入型持久化 QA

使用 Phase 06 worktree 的隔离 API 服务与干净 SQLite 数据库验证，不污染 master 或已有 demo 服务。

验证覆盖：

- Page 04 “我已提交”：
  - `permission_progress` 写入成功。
  - `follow_up_tasks` 创建成功。
  - 重新读取后权限进度和 follow-up 仍存在。
- Page 03 “一键申请”：
  - 权限申请状态持久化。
  - 4 小时 follow-up 任务持久化。
  - 重新读取后状态仍存在。
- Page 06 首周反馈：
  - 无效提交被后端校验拒绝。
  - 有效提交写入 `weekly_feedbacks` / `weekly_feedback_answers`。
  - 重新读取后首周反馈仍存在。
- Page 07 匿名反馈：
  - 无效提交被后端校验拒绝。
  - 有效提交写入 `anonymous_feedbacks`。
  - 后台匿名反馈池可读取该反馈。
- Page 12 管理者跟进行动：
  - manager action 写入成功。
  - 重新读取后 `managerActionStatus` 和 `actionNote` 仍存在。
- 权限边界：
  - manager API 缺少 manager header 返回 403。
  - unknown manager actor 返回 403。
  - admin API 缺少 admin header 返回 403。

## 5. 自动化验证

最终验证命令：

```powershell
npm.cmd test
npm.cmd run build
git diff --check
git status --short --branch
```

结果：

- `npm.cmd test`
  - 115 个测试通过。
  - 0 失败。
- `npm.cmd run build`
  - TypeScript 编译通过。
  - Vite production build 通过。
- `git diff --check`
  - 无 whitespace 错误。
  - Windows 提示 `LF will be replaced by CRLF`，不影响 diff check。
- `git status --short --branch`
  - Phase 06 worktree 仅保留本次预期改动。
  - master 工作区保持干净。

## 6. 已知规格差异

Phase 05 原始 spec 曾写管理端底栏为 `总览 / 新人 / 反馈 / 我的`，Page 11 只显示 weekly feedback summary。

用户后续明确覆盖旧 spec，当前实现按用户最新指令保留：

- 去掉“我的”。
- 去掉底栏“反馈”。
- 管理端底栏只保留“总览 / 新人”。
- Page 10 标题使用“入职管理”。
- Page 10 使用“周内到岗名单”，D8 后不展示。
- Page 10 新人卡片使用整卡点击和三角进入详情。
- Page 11 同步新人端 Page 06 首周反馈内容快照。

该差异属于“用户最新显式指令覆盖旧 spec”，不是未完成项。

## 7. 下一阶段建议

下一阶段建议新增 Phase 07：`deployment-pilot-readiness`。

目标不是直接接入真实飞书，而是先让当前 MVP 达到“小范围内部试点可部署”的工程状态：

- 明确部署拓扑。
- 明确数据库路径、备份、迁移和回滚。
- 增加最小访问控制方案。
- 准备 HTTPS / 域名或内网访问方案。
- 准备运行守护和日志策略。
- 保持当前外部集成 mock 边界不变。

真实飞书打通应在稳定部署地址和访问控制确认后再进入，先做最小入口，再逐步接 Bot、事件和消息能力。

