# Haina AI Onboarding Bot H5 - Phase 06 Handoff

Updated: 2026-07-02
Workspace: `C:\Users\HDL\Documents\<Haina onboarding bot project root>`
Current branch: `master`
Latest commit at handoff time: `4e83eb4 Merge branch 'codex/phase-05-manager-flow'`
Working tree before this document update: clean

This file is intentionally written in ASCII English so the next Codex session can load it reliably on Windows without mojibake.

## 1. Current Stage

Phase 00-05 implementation is substantially complete.

Next stage:

`docs/specs/phase-06-final-qa.md`

Phase 06 is final QA and delivery hardening. It should not add major new product scope. It should verify all 12 pages, route refresh behavior, P0 backend persistence, mobile visual quality, admin config propagation, manager permissions, anonymous feedback boundaries, and forbidden real integrations.

## 2. Key Decisions

1. P0 business data must go through the real Node backend and SQLite database.
2. Browser-only state is not acceptable for P0 records.
3. No real login in this MVP.
4. No real Feishu APIs.
5. No real approval APIs.
6. No real RAG, vector database, LLM, upload parsing, or real document retrieval.
7. No real message sending.
8. Page 06 is named weekly feedback from the newcomer to the manager.
9. Page 07 is anonymous process feedback for product/content/permission owners.
10. Manager pages must never expose anonymous feedback raw text.
11. Page 12 is a read-only manager view of Page 06 weekly feedback, not a performance evaluation page.
12. Manager features are for onboarding support and follow-up only. Do not add scoring, ranking, performance review, ability evaluation, or chat-history exposure.
13. Admin config uses soft-disable semantics through `enabled` or status fields. Do not physically delete config rows.
14. Admin save flows must have backend validation, audit fields, and refresh persistence.
15. Newcomer, review, and manager pages must read admin-configured data instead of hardcoded roles, permissions, questions, knowledge docs, or anonymous feedback config.
16. Knowledge base remains metadata-only in this phase. Parsing, vectorization, and RAG are simulated.

## 3. Completed Work

### Phase 00-03: Backend MVP and Newcomer Flows

- Node native backend, routeKit-style routing, and SQLite persistence are in place.
- Core P0 tables and seed data are available.
- Newcomer homepage, D1 guide, permission package, permission detail, 4-hour follow-up, weekly feedback, and anonymous feedback are backend-backed.
- Permission progress writes to `permission_progress`.
- One-click permission application persists progress and creates follow-up tasks.
- 4-hour follow-up writes to `follow_up_tasks`.
- Weekly feedback writes to `weekly_feedbacks` and structured `weekly_feedback_answers`.
- Anonymous feedback writes to `anonymous_feedbacks` and structured classification fields.
- Page 06 text answers are isolated by `questionId`; multiple text questions no longer share one state value.

### Phase 04A: Writable Admin Config

- `/admin-config` is implemented as a desktop admin workbench, not an H5 phone page.
- All admin modules are kept inside `/admin-config` tabs:
  - overview
  - role packages
  - D1 guide
  - weekly feedback
  - anonymous feedback config
  - knowledge base
  - feedback pool
- Admin config persists through the real backend and SQLite.
- Roles can be created, edited, disabled, and restored.
- Disabled roles are hidden by default from newcomer and manager surfaces but remain recoverable in admin.
- Role permission packages support required/optional permissions, owner, apply entry, approver, reason template, and common waiting reasons.
- Required permission disabling is guarded by backend validation.
- D1 guide has three fixed items and uses edit/enable/disable only.
- Weekly feedback questions support create, edit, copy, disable, option editing, and ordering.
- Weekly feedback ordering is persisted and consumed by newcomer and manager surfaces.
- Anonymous feedback module/type/action config is editable and linked by module.
- Knowledge docs save metadata only, with simulated parse/vector states and backend state-machine guards.
- Feedback pool supports processing status, result, resolution note, handler name, handled time, and included-in-review flag.
- Admin audit fields are preserved: `updatedAt`, `updatedBy`, `handlerName`, `handledAt`, `resolutionNote`.
- Admin workbench UI has had multiple layout-density and desktop usability passes.

### Phase 04B: Review Closeout

- `/review` reads backend-derived metrics.
- Review reads knowledge doc counts, anonymous feedback type/status summaries, and configured anonymous modules.
- Review does not expose anonymous feedback raw text.
- Review links back to admin knowledge and feedback-pool tabs.

### Phase 05: Manager Flow

- `/manager` manager overview is implemented.
- `/manager/newcomer/:id` newcomer weekly tracking detail is implemented.
- `/manager/feedback/:id` manager weekly feedback read-only page is implemented.
- Manager surfaces use dedicated manager APIs instead of admin-only APIs.
- Manager requests use demo manager headers; backend derives manager scope from actor.
- Missing or unknown manager actors return 403.
- Cross-manager access to another manager's newcomer or feedback returns 404.
- Manager pages do not show anonymous feedback raw text.
- Manager role statistics read enabled roles only and update when admin disables a role.
- Manager newcomer list uses `join_feishu_org.completedAt` to calculate D1-D7.
- D8+ newcomers are excluded from the weekly arrival list.
- Page 11 mirrors the Page 06 weekly feedback snapshot.
- Page 12 manager action persists and survives refresh.
- Manager bottom navigation follows the latest user-approved scope: `overview / newcomers`.

## 4. Architecture Notes

### Layering

- Frontend pages: rendering, interaction, lightweight UI state.
- API client: HTTP requests, error formatting, demo headers.
- Routes: URL-to-handler mapping only.
- Services: validation, business rules, authorization boundary, aggregation.
- Repositories: SQL reads/writes.
- SQLite: P0 persisted data.

### Admin Config Boundary

- Config tables and business records are separate.
- Config changes affect future display; they do not clear historical records.
- Disabling config does not delete rows.
- Historical records must still render when linked config is disabled.
- Backend writes audit fields; do not trust frontend `updatedBy`.

### Manager Boundary

- Manager pages must not call `/api/admin/*` or `/api/admin-config/*`.
- Manager pages read scoped DTOs from `/api/manager/*`.
- Frontend must not pass trusted `managerId` or `departmentId`.
- Backend derives manager scope from demo actor.
- Future real auth should replace the demo actor with Session/JWT user context, not expand frontend-trusted params.

### Feedback Boundary

- Page 06: named weekly feedback, visible to manager.
- Page 07: anonymous process feedback, not visible to manager as raw text.
- Page 11: manager sees weekly feedback snapshot.
- Page 12: manager sees full named weekly feedback and records follow-up.
- `/review`: aggregated anonymous feedback categories/status only; no raw anonymous text.

## 5. Important File Map

### Frontend

- `src/frontend/routes.ts`
  - Owns the 12 page routes, page numbers, titles, and bottom nav metadata.

- `src/frontend/App.tsx`
  - Shell entry and surface-level layout.

- `src/frontend/AppContent.tsx`
  - Page dispatch and admin page guard.

- `src/frontend/appState.ts`
  - Data loading boundary for newcomer, admin, review, and manager surfaces.

- `src/frontend/api.ts`
  - API client, request headers, frontend data types, and error handling.

- `src/frontend/pages/AdminConfig/*`
  - Admin config workbench tabs.
  - Key files: `RolePackagesTab.tsx`, `WeeklyFeedbackTab.tsx`, `AnonymousConfigTab.tsx`, `KnowledgeTab.tsx`, `FeedbackPoolTab.tsx`.

- `src/frontend/services/adminConfigApi.ts`
  - Admin config service wrapper used by the frontend.

- `src/frontend/pages/newcomerPages.tsx`
  - Main newcomer H5 pages.
  - Page 06 dynamic weekly feedback rendering and text-answer isolation.

- `src/frontend/pages/managerPages.tsx`
  - Page 10, Page 11, Page 12 manager UI.

- `src/frontend/pages/ReviewPage.tsx`
  - Phase 04B review surface.

- `src/frontend/styles.css`
  - Main visual styling for newcomer, admin, review, and manager surfaces.

### Backend

- `src/server/index.ts`
  - Server startup and seed repair execution.

- `src/server/apiRoutes.ts`
  - Route composition and admin/manager guards.

- `src/server/contracts.ts`
  - Shared backend status contracts and validation helpers.

- `src/server/routes/adminRoutes.ts`
  - Admin config routes.

- `src/server/routes/managerRoutes.ts`
  - Manager routes.

- `src/server/routes/reviewRoutes.ts`
  - Review metrics routes.

- `src/server/services/adminService.ts`
  - Admin write validation, soft-disable behavior, audit handling, config updates.

- `src/server/services/newcomerService.ts`
  - Newcomer data, permission progress, follow-up tasks, feedback submission.

- `src/server/services/managerService.ts`
  - Manager scope, D1-D7 calculation, overview aggregation, detail DTOs, feedback action updates.

- `src/server/services/reviewService.ts`
  - Review metric aggregation.

- `src/server/repositories/*`
  - SQL query/write wrappers. `managerRepository.ts` is the manager-specific repository.

- `src/server/migrations.ts`
  - Legacy DB compatibility migrations.
  - Do not rely on `CREATE TABLE IF NOT EXISTS` to update existing tables.

- `src/server/seed.ts`
  - Demo seed and repair logic.

- `db/migrations/001_initial.sql`
  - Initial schema and indexes.

### Tests

- `tests/phase00-api.test.ts`
  - Core P0 API flows.

- `tests/phase04a-admin-config.test.ts`
  - Admin config write/persist/reload/downstream contract.

- `tests/phase04b-review.test.ts`
  - Review read-only and anonymous boundary checks.

- `tests/phase05-manager-flow.test.ts`
  - Manager overview, D1-D7 filtering, role enable/disable sync, scope checks, Page 10/11/12 behavior.

- `tests/frontend-architecture.test.ts`
  - Frontend data boundary checks, especially manager not loading admin-only data.

- `tests/backend-errors.test.ts`
  - Error response shape and admin/manager guard tests.

- `tests/seed-compat.test.ts`
  - Legacy database repair tests.

- `tests/weekly-feedback-form-model.test.ts`
  - Weekly feedback answer isolation.

- `tests/weekly-feedback-question-ordering.test.ts`
  - Weekly feedback question ordering model.

## 6. Recent Important Commits

- `4e83eb4 Merge branch 'codex/phase-05-manager-flow'`
- `b9f4284 fix: tighten admin config desktop layout`
- `6fb9f89 fix: compact admin filter topbar`
- `2bb47f0 fix: stabilize weekly feedback ordering`
- `abcdfc4 fix: harden manager and knowledge guardrails`
- `cdb4115 docs: add phase 06 handoff summary`
- `ddc6245 fix: prevent admin date filter clipping`
- `ce339d5 fix: harden manager flow boundaries`
- `2502996 feat: implement manager feedback workflow`
- `a8f8e45 fix: anchor sqlite database path to project root`
- `378e05b fix: make weekly feedback ordering deterministic`
- `75b4dce fix: isolate weekly feedback text answers`
- `8799a28 fix: support disabling admin role packages`
- `44ffe73 feat: implement writable admin config workbench`

## 7. Phase 06 Todo

### 7.1 Route QA

Verify all 12 pages can be opened and refreshed without blank screens:

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

### 7.2 Interaction QA

- Page 01 -> Page 02 -> Page 03.
- Page 03 one-click apply persists permission progress.
- Page 03 one-click apply creates `follow_up_tasks`.
- Page 03 detail -> Page 04.
- Page 04 submitted -> Page 05.
- Refresh keeps permission progress and follow-up.
- Page 05 anonymous feedback -> Page 07.
- Page 01 D6/D7 weekly feedback entry -> Page 06 -> submit -> Page 01.
- Refresh keeps weekly feedback.
- Admin weekly question ordering updates newcomer and manager order.
- Admin role disable hides role from newcomer and manager surfaces but keeps it recoverable in admin.
- Page 10 newcomer card -> Page 11.
- Page 11 and Page 12 weekly feedback data stay consistent.
- Page 12 manager action persists after refresh.
- Page 09 -> Page 08 knowledge and feedback-pool tabs.

### 7.3 Backend Persistence QA

Check these tables after flows:

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
- admin config tables

### 7.4 Security and Boundary QA

- Manager API without manager header returns 403.
- Unknown manager actor returns 403.
- Other manager accessing another manager's data returns 404.
- Admin API without admin header returns 403.
- Manager pages do not show anonymous feedback raw text.
- Review page does not show anonymous feedback raw text.
- Manager pages do not include performance review, ability score, or ranking.
- No real Feishu, approval, RAG, upload, parse, vector, LLM, or message-sending API calls exist.

### 7.5 Visual QA

Use mobile viewport as the primary target:

- Text does not overflow.
- Button labels fit.
- Bottom nav does not cover content.
- Scrolling is normal.
- Card spacing is consistent.
- Status colors are consistent.
- Desktop phone shell is centered.
- Admin desktop tables, drawers, and top filters do not overlap or clip.

### 7.6 Technical Commands

Run after Phase 06 fixes:

```powershell
npm.cmd test
npm.cmd run build
git diff --check
git status --short --branch
```

Local startup:

```powershell
npm.cmd run dev:api
npm.cmd run dev
```

If Windows watch/PATH fails:

```powershell
& 'C:\Program Files\nodejs\node.exe' --watch src/server/index.ts
```

## 8. Known Spec Differences

The original Phase 05 spec listed manager bottom nav as `overview / newcomers / feedback / mine`, and Page 11 as weekly feedback summary only.

The user's later explicit instructions override that older spec:

- Remove `mine`.
- Remove bottom-nav `feedback`.
- Page 11 mirrors the newcomer Page 06 weekly feedback content snapshot.
- Page 10 is a weekly arrival list; D8+ newcomers are hidden.
- Page 10 newcomer cards use card-click and triangle cue instead of status badges/text buttons.

Phase 06 should preserve this as a documented "latest user instruction overrides older spec" decision.

## 9. Startup Prompt For Next Session

```text
Continue developing the Haina AI Onboarding Bot H5 MVP and enter Phase 06 Final QA.

Current project path:
C:\Users\HDL\Documents\<Haina onboarding bot project root>

Current branch:
master

Latest known commit:
4e83eb4 Merge branch 'codex/phase-05-manager-flow'

Read first:
AGENTS.md
.agents/skills/haina-onboarding-h5/SKILL.md
docs/specs/phase-06-final-qa.md
docs/handoffs/phase-06-final-qa-handoff.md

Key boundaries:
- P0 data must use the real backend and SQLite.
- No real login, Feishu, approval, RAG, upload parsing, or message sending.
- Page 06 is named weekly feedback visible to managers.
- Page 07 is anonymous feedback; managers must not see raw text.
- Page 12 is manager read-only named weekly feedback, not performance evaluation.
- Admin config uses soft-disable, not physical delete.

Goal:
Run full 12-page QA, P0 persistence checks, refresh persistence checks, mobile visual QA, permission-boundary checks, anonymous feedback non-leak checks, and fix any issues found.

Required final commands:
npm.cmd test
npm.cmd run build
git diff --check
git status --short --branch
```
