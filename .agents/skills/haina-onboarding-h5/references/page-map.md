# Page Map Reference

> Legacy reference: Phase 09 removed D1, weekly feedback, anonymous feedback, V1 review, and manager surfaces from the active runtime. The final newcomer/admin page map is intentionally deferred. See `docs/specs/phase-09-product-scope-convergence.md`.

## Pages

| Page | Route | Name | Owner View |
|---|---|---|---|
| 01 | `/` | 新人首页 / 智能体主入口 | 新人 |
| 02 | `/d1` | D1 到达引导包 | 新人 |
| 03 | `/permissions` | 岗位权限包 | 新人 |
| 04 | `/permission-detail/:id` | 权限详情 / 进度登记 | 新人 |
| 05 | `/follow-up/:taskId` | 4 小时回访 / 未完成处理 | 新人 |
| 06 | `/weekly-feedback` | 新人首周反馈填写 | 新人 |
| 07 | `/anonymous-feedback` | 匿名反馈 | 新人 |
| 08 | `/admin-config` | 后台配置维护台 | 内容 / 权限 Owner |
| 09 | `/review` | V1 灰度试点复盘 | 产品 / 管理者 |
| 10 | `/manager` | 管理者首页 / 今日新员工概览 | 管理者 |
| 11 | `/manager/newcomer/:id` | 新人首周跟踪详情 | 管理者 |
| 12 | `/manager/feedback/:id` | 管理者视角 / 新人首周反馈 | 管理者 |

## Critical Distinctions

### Page 06 vs Page 07

Page 06:

- Not anonymous.
- Filled by the newcomer.
- Visible to manager / +1 / mentor.
- Used for first-week support and follow-up.
- Not used for performance review.

Page 07:

- Anonymous by default.
- Submitted by the newcomer.
- Visible in the admin anonymous feedback pool.
- Used by product/content owners to improve process, knowledge base, and permission templates.
- Not shown to managers as原文.

### Page 11 vs Page 12

Page 11:

- Shows D1-D7 actions, permission progress, blockers, suggestions.
- Shows only weekly feedback summary and “查看完整反馈”.
- Does not repeat the full “新人想说的话”.

Page 12:

- Shows complete weekly feedback.
- Manager read-only.
- Supports “安排沟通”, “记录已查看”, and empty state.

## Required Transitions

- 新人首页 → D1 到达引导
- 新人首页 → 岗位权限包
- 新人首页 → 权限详情
- 新人首页 → 新人首周反馈填写
- 新人首页 → 匿名反馈
- 新人首页知识库回答 → 权限详情
- 新人首页知识库回答 → 匿名反馈
- D1 到达引导 → 岗位权限包
- 岗位权限包 → 权限详情
- 权限详情 → 4 小时回访
- 4 小时回访 → 匿名反馈
- 新人首周反馈填写 → 新人首页
- 后台配置维护台 → 知识库上传窗口
- V1 灰度试点复盘 → 后台配置维护台
- 管理者首页 → 新人首周跟踪详情
- 新人首周跟踪详情 → 管理者视角 / 新人首周反馈
- 管理者首页底部“反馈” → 最近提交反馈的新人的 page 12 / no feedback toast

## State Rules

- `weeklyFeedbackSubmitted=false` and stage D6/D7: show “填写首周反馈” entry on newcomer home.
- Page 06 submit: POST to backend, write/update `weekly_feedbacks`, set the newcomer's `weeklyFeedbackSubmitted=true`.
- Permission one-click apply: persist selected permission status as in-progress/submitted demo state, create/update follow-up task with `submittedAt`, `followUpAt`, and `status`, and stay on page 03.
- Permission detail “我已提交”: POST progress registration, create/update follow-up task with `submittedAt`, `followUpAt`, and `status`, then route to page 05.
- Page 05 only shows backend follow-up tasks with status “待回访”.
- Page 12 manager actions persist `managerViewed` and `managerActionStatus`.

## P0 Database-Backed Areas

- Role permission package configuration.
- Permission route/detail configuration.
- Newcomer onboarding task state.
- Permission progress registrations.
- Four-hour follow-up tasks.
- Anonymous feedback submissions.
- Weekly feedback submissions.
- Manager view/action records.
- Admin configuration and feedback tables.
