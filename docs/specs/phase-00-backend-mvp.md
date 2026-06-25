# Phase 00 Spec: Backend MVP

## Goal

Build the real backend and database foundation for the P0 pilot scope.

## Product Boundary

This phase makes P0 business data persistent. It does not connect to real Feishu, approval, RAG, upload parsing, LLM, or message-sending systems.

## Default Technical Direction

If the project has no existing backend stack when implementation starts, use a pragmatic local-first stack that can later move to a pilot database:

- TypeScript backend.
- REST-style JSON APIs.
- SQL database with migration files.
- Seed script for demo/pilot data.
- Repository/service layer so UI pages do not write database state directly.

The exact framework can follow the app scaffold chosen during implementation, but the data model and API behavior below are required.

## Required Database Tables

### `roles`

Stores job/role definitions.

Required fields:

- `id`
- `name`
- `department`
- `description`
- `createdAt`
- `updatedAt`

### `permission_items`

Stores permission items that can appear in a role permission package.

Required fields:

- `id`
- `name`
- `category`
- `permissionType`: `required` or `optional`
- `sensitive`
- `ownerName`
- `ownerContact`
- `applyUrl`
- `reasonTemplate`
- `approverName`
- `commonWaitingReasons`
- `enabled`
- `createdAt`
- `updatedAt`

### `role_permission_items`

Maps roles to required/optional permissions.

Required fields:

- `id`
- `roleId`
- `permissionItemId`
- `sortOrder`
- `createdAt`
- `updatedAt`

### `newcomers`

Stores pilot newcomer records.

Required fields:

- `id`
- `name`
- `roleId`
- `department`
- `stage`
- `managerName`
- `mentorName`
- `status`
- `d1GuideCompleted`
- `permissionPackageViewed`
- `weeklyFeedbackSubmitted`
- `managerViewedFeedback`
- `createdAt`
- `updatedAt`

### `newcomer_task_states`

Stores D1 guide and onboarding task state.

Required fields:

- `id`
- `newcomerId`
- `taskKey`
- `taskName`
- `status`
- `completedAt`
- `createdAt`
- `updatedAt`

### `permission_progress`

Stores per-newcomer permission progress.

Required fields:

- `id`
- `newcomerId`
- `permissionItemId`
- `status`
- `submittedAt`
- `completedAt`
- `lastActionAt`
- `createdAt`
- `updatedAt`

### `follow_up_tasks`

Stores 4-hour follow-up tasks.

Required fields:

- `id`
- `newcomerId`
- `permissionProgressId`
- `submittedAt`
- `followUpAt`
- `status`
- `ownerName`
- `createdAt`
- `updatedAt`

### `anonymous_feedbacks`

Stores anonymous feedback submissions.

Required fields:

- `id`
- `feedbackNo`
- `type`
- `module`
- `description`
- `expectedAction`
- `isAnonymous`
- `contactName`
- `contactInfo`
- `submittedByNewcomerId`
- `submittedAt`
- `ownerName`
- `status`
- `result`
- `includedInReview`
- `createdAt`
- `updatedAt`

### `weekly_feedbacks`

Stores newcomer weekly feedback for managers.

Required fields:

- `id`
- `newcomerId`
- `overallFeeling`
- `blockers`
- `supportNeeded`
- `message`
- `visibleToManager`
- `lifecycle`
- `submittedAt`
- `createdAt`
- `updatedAt`

### `manager_feedback_actions`

Stores manager view and action state for weekly feedback.

Required fields:

- `id`
- `weeklyFeedbackId`
- `managerName`
- `managerViewed`
- `managerViewedAt`
- `managerActionStatus`
- `actionNote`
- `createdAt`
- `updatedAt`

### `knowledge_base_docs`

Stores knowledge metadata for admin/review display. Real upload parsing is not required in P0.

Required fields:

- `id`
- `title`
- `category`
- `applicableRole`
- `applicableStage`
- `sourceUrl`
- `ownerName`
- `status`
- `parseStatus`
- `vectorStatus`
- `hitCount`
- `updatedAt`
- `createdAt`

## Required API Groups

### Role Permission Package

- `GET /api/roles`
- `GET /api/roles/:roleId/permission-package`
- `POST /api/admin/roles`
- `POST /api/admin/role-permission-items`
- `PATCH /api/admin/permission-items/:id`

### Permission Route / Detail

- `GET /api/permission-items/:id`
- `GET /api/permission-items/:id/route`

### Newcomer State

- `GET /api/newcomers/:id`
- `PATCH /api/newcomers/:id/task-states/:taskKey`
- `PATCH /api/newcomers/:id`

### Permission Progress And Follow-Up

- `POST /api/newcomers/:id/permission-progress`
- `GET /api/newcomers/:id/permission-progress`
- `GET /api/follow-up-tasks/:taskId`
- `PATCH /api/follow-up-tasks/:taskId`

### Feedback

- `POST /api/anonymous-feedbacks`
- `GET /api/admin/anonymous-feedbacks`
- `PATCH /api/admin/anonymous-feedbacks/:id`
- `POST /api/weekly-feedbacks`
- `GET /api/newcomers/:id/weekly-feedback`
- `GET /api/manager/feedback/:weeklyFeedbackId`
- `PATCH /api/manager/feedback/:weeklyFeedbackId/action`

### Admin And Review

- `GET /api/admin/config`
- `PATCH /api/admin/config`
- `GET /api/admin/knowledge-base-docs`
- `POST /api/admin/knowledge-base-docs`
- `GET /api/review/metrics`

## Required Seed Data

Seed enough data to demo:

- Role: 协同办公产品实习生.
- Required permissions: OA 系统, Mail 海底捞邮箱.
- Optional permissions: BPM 系统, ChatGPT 账号, QoderWork 账号.
- Newcomers: 燕余 and 崔令飞.
- At least one permission progress record.
- At least one follow-up task.
- At least one anonymous feedback.
- At least one weekly feedback.
- At least one manager feedback action.
- At least three knowledge base docs.

## Acceptance Criteria

- Database migrations create all required P0 tables.
- Seed script can reset and recreate demo data.
- All required API groups return JSON.
- API validation rejects invalid feedback submissions.
- Clicking “我已提交” can persist permission progress and create a follow-up task.
- Anonymous feedback can be submitted and reloaded from `anonymous_feedbacks`.
- Weekly feedback can be submitted and reloaded from `weekly_feedbacks`.
- Manager action status can be updated and reloaded.
- Admin page can read real configuration and feedback data.
- No P0 persistence depends only on front-end state.

