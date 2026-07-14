---
name: haina-onboarding-h5
description: Use when developing, reviewing, planning, or QAing the 海纳 AI 入职 Bot H5 MVP from the final PRD. Applies to AGENTS.md-driven project work, phase specs in docs/specs, P0 real backend/database scope, page routing, seeded data, newcomer permission flows, weekly feedback, anonymous feedback, admin/review pages, and manager views.
---

# 海纳入职 H5 开发 Skill

## Purpose

Use this skill to keep development aligned with the final PRD for the 海纳 AI 入职 Bot H5 pilot MVP.

The output must be a mobile-first H5 MVP that can support product review, leadership demo, development alignment, and small pilot usage. P0 business data must use a real backend and database.

## Current Phase 09 Override

The latest approved scope keeps only the newcomer H5 and admin configuration console. D1 guide, weekly feedback, anonymous feedback, V1 review, and manager surfaces are legacy modules and must not be restored to the active runtime. The final replacement page map is intentionally undecided. Read `docs/specs/phase-09-product-scope-convergence.md` before planning or implementation.

Keep legacy SQLite tables and historical records for rollback compatibility. Do not physically delete them without a separately approved migration and backup plan.

## Always Start Here

1. Read `AGENTS.md`.
2. Read the relevant phase spec under `docs/specs/`.
3. If page numbering, routes, persisted data, seeded data, or acceptance criteria are unclear, read `references/page-map.md`.
4. Treat the final PRD as the product source of truth:
   `C:\yanyu\新人入职BAT\阶段二\开发文档2(1).md`

## Legacy P0 Real Backend Scope

Build real backend APIs and database tables for:

- 岗位权限包表: role, required permissions, optional permissions, Owner, apply entry.
- 权限申请路由表: apply entry, reason template, approver, common waiting reasons.
- 新人入职任务状态: D1 guide, permission view, submit state, completion state.
- 权限进度登记: write database record when “我已提交” is clicked.
- 4 小时回访任务: persist `submittedAt`, `followUpAt`, `status`.
- 匿名反馈: write to `anonymous_feedbacks`.
- 新人首周反馈: write to `weekly_feedbacks`.
- 管理者查看记录: persist `managerViewed` and `managerActionStatus`.
- 后台配置维护台: read/write real configuration and feedback tables.

Use seed data for demos, but route P0 UI through backend APIs rather than front-end-only state.

## Hard Boundaries

Do not build real external integrations unless explicitly requested:

- No real login.
- No real Feishu APIs.
- No real approval APIs.
- No real RAG, vector database, or LLM call.
- No real file upload, parsing, vectorization, or knowledge retrieval.
- No real message sending,催办,提醒, or approval submission.

Use front-end state, route changes, modals, and toast messages only to simulate non-P0 external behaviors. Do not simulate P0 persistence purely in the browser.

## Legacy Product Logic Guardrails

- Page 06 is 新人首周反馈填写: named, non-anonymous, written by the newcomer, visible to managers.
- Page 07 is 匿名反馈: anonymous process feedback for product/content owners, not manager原文.
- Page 12 is 管理者视角 / 新人首周反馈: manager read-only view of page 06 feedback.
- 4 小时回访 is triggered after the newcomer registers a permission as submitted, including page 04 “我已提交” and the confirmed page 03 one-click permission application flow in this MVP.
- Clicking “一键申请” updates selected permission applications to in-progress/submitted demo state, persists the records, creates 4-hour follow-up tasks, and still must not call real approval or Feishu APIs.
- Manager views must support onboarding help and follow-up only. Do not add绩效评价,能力评分,排名, or chat history exposure.

## Development Workflow

Use the phase specs in order:

0. Backend MVP schema, seed data, and API contracts.
1. Foundation shell wired to backend data access boundaries.
2. Newcomer permission flow with persisted task/progress/follow-up state.
3. Weekly feedback and anonymous feedback with real table writes.
4. Admin config and V1 review reading real backend data.
5. Manager overview, newcomer detail, and manager feedback view with persisted manager actions.
6. Final QA and consistency pass.
7. Pilot deployment readiness for runtime, access, database backup, and runbook preparation. This is not a real Feishu or approval integration phase.

After each phase:

- Run the app locally.
- Verify all routes introduced in that phase.
- Check mobile layout first.
- Check route/page number consistency.
- Check that P0 API calls persist and reload correctly.
- Check that seed data remains valid and repeatable.
- Record any deviation from the PRD before continuing.

## UI Guidance

- The first screen should be the product experience, not a landing page.
- Preserve the blue/white mobile Feishu card style.
- Use cards for contained information and repeated items.
- Keep page copy short enough for mobile screens.
- Use green for completed/success, orange for pending/attention, red for risk/error, and purple only as a secondary cue for AI/knowledge/feedback.
- Desktop view may center the phone prototype; mobile view must be primary.

## Reference

Read `references/page-map.md` when you need exact page numbers, routes, route transitions, or ownership boundaries.
