# AGENTS.md

## Project

海纳 AI 入职 Bot H5 高保真原型。

This repository is developed from the final PRD at:

`C:\yanyu\新人入职BAT\阶段二\开发文档2(1).md`

The product is a mobile-first H5 MVP for small pilot use. It must simulate the Feishu mobile Bot / message-card experience, and P0 business data must use a real backend and database. External Feishu, approval, RAG, upload, and messaging integrations are still simulated unless the user explicitly expands scope.

## Required Project Skill

Before planning or implementing project work, use the project skill:

`.agents/skills/haina-onboarding-h5/SKILL.md`

Use the skill together with the phase specs in `docs/specs/`. The skill defines product boundaries, page map, state rules, and development discipline. The specs define what to build and verify in each phase.

## Source Of Truth

Priority order:

1. User's latest explicit instruction.
2. `C:\yanyu\新人入职BAT\阶段二\开发文档2(1).md`
3. `.agents/skills/haina-onboarding-h5/SKILL.md`
4. `docs/specs/*.md`
5. Existing codebase conventions once implementation exists.

If any spec appears to conflict with the final PRD, stop and reconcile the conflict before implementing.

## P0 Backend MVP Scope

P0 must use real backend APIs and database tables for these capabilities:

| Capability | Backend requirement |
|---|---|
| 岗位权限包表 | Backend can configure role, required permissions, optional permissions, Owner, and apply entry. |
| 权限申请路由表 | Store apply entry, reason template, approver, and common waiting reasons. |
| 新人入职任务状态 | Persist D1 guide state, permission page viewed state, submit state, and completion state. |
| 权限进度登记 | When user clicks “我已提交”, write the progress record to the database. |
| 4 小时回访任务 | Backend stores `submittedAt`, `followUpAt`, and `status`. |
| 匿名反馈 | Submit to the real `anonymous_feedbacks` table. |
| 新人首周反馈 | Submit to the real `weekly_feedbacks` table. |
| 管理者查看记录 | Persist `managerViewed` and `managerActionStatus`. |
| 后台配置维护台 | Read and update real configuration tables and feedback tables. |

## Non-Negotiable Product Boundaries

- Build a mobile-first H5 pilot MVP with a high-fidelity mobile experience and P0 backend persistence.
- Do not implement real login.
- Do not call real Feishu APIs.
- Do not call real approval APIs.
- Do not call a real RAG, vector, or LLM service.
- Do not implement real file upload, parsing, vectorization, or knowledge retrieval.
- Do not send real messages, reminders, or approvals.
- Do not expose anonymous feedback原文 to managers.
- Do not add performance evaluation, ability scoring, or employee ranking.

Mock is allowed only for non-P0 external integrations and demo-only UI behaviors. P0 data listed above must not be implemented as front-end-only state.

## Final Page Map

The H5 contains exactly 12 pages:

1. 新人首页 / 智能体主入口
2. D1 到达引导包
3. 岗位权限包
4. 权限详情 / 进度登记
5. 4 小时回访 / 未完成处理
6. 新人首周反馈填写
7. 匿名反馈
8. 后台配置维护台
9. V1 灰度试点复盘
10. 管理者首页 / 今日新员工概览
11. 新人首周跟踪详情
12. 管理者视角 / 新人首周反馈

Page 06 and page 07 must remain separate:

- Page 06: named, non-anonymous weekly feedback written by the newcomer for the manager.
- Page 07: anonymous process feedback for product/content owners, not shown to managers as原文.

## Required Routes

```text
/                              新人首页
/d1                            D1 到达引导
/permissions                   岗位权限包
/permission-detail/:id         权限详情
/follow-up/:taskId             4 小时回访
/weekly-feedback               新人首周反馈填写
/anonymous-feedback            匿名反馈
/admin-config                  后台配置维护台
/admin-config?tab=knowledge    后台知识库管理
/admin-config?tab=feedback     后台匿名反馈池
/review                        V1 灰度试点复盘
/manager                       管理者首页
/manager/newcomer/:id          新人首周跟踪详情
/manager/feedback/:id          管理者视角 / 新人首周反馈
```

## Phase Specs

Implement in this order:

1. `docs/specs/phase-00-backend-mvp.md`
2. `docs/specs/phase-01-foundation-shell.md`
3. `docs/specs/phase-02-newcomer-permission-flow.md`
4. `docs/specs/phase-03-feedback-flows.md`
5. `docs/specs/phase-04-admin-and-review.md`
6. `docs/specs/phase-05-manager-flow.md`
7. `docs/specs/phase-06-final-qa.md`

Each phase must leave the app runnable and visually coherent.

## Implementation Discipline

- Keep the first screen as the actual product experience, not a marketing landing page.
- Preserve the blue/white Feishu mobile card style from the PRD.
- Make mobile layout the primary target; desktop may center the phone prototype.
- Use real backend APIs for P0 persisted data and seeded database fixtures for demo data.
- Use local mock data only for non-P0 external integrations such as Feishu, approval submission, RAG answers, upload parsing, and message sending.
- Make route/page names, data field names, and acceptance criteria match the PRD exactly.
- Prefer small focused components over one large page file once code exists.
- Verify each phase against its spec before moving to the next phase.

## Suggested Commit Rhythm

Commit after each phase reaches its acceptance criteria:

- `feat: scaffold haina onboarding h5 shell`
- `feat: add backend mvp schema and api`
- `feat: implement newcomer permission flow`
- `feat: implement weekly and anonymous feedback flows`
- `feat: implement admin config and review pages`
- `feat: implement manager feedback workflow`
- `test: complete final h5 qa pass`
