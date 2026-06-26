# 0006 Phase 04A Admin Guardrails

## Status

Accepted

## Context

Phase 04A turns `/admin-config` into an operations configuration center. If admin writes are loose, the review page and manager flow will need rework because historical newcomer records can lose their configuration references.

## Decision

Before expanding admin UI, admin writes must satisfy this checklist:

- Configuration tables: `roles`, `permission_items`, `role_permission_items`, `d1_guide_configs`, `weekly_feedback_questions`, `weekly_feedback_options`, `anonymous_feedback_modules`, `anonymous_feedback_problem_types`, `anonymous_feedback_expected_actions`, `knowledge_base_docs`.
- Business record tables: `permission_progress`, `follow_up_tasks`, `weekly_feedbacks`, `anonymous_feedbacks`, `manager_feedback_actions`.
- Statistics: computed from business/configuration tables, not manually edited.
- Configuration changes use `enabled` or `status`; no physical delete in Phase 04A.
- Historical records keep stable ids such as `permissionItemId` and must still render when related config is disabled.
- Admin save APIs validate required fields, URL shape, parent-child config references, duplicate role-permission bindings, and weekly feedback cannot have all questions disabled.
- Admin writes reserve `updatedAt` and `updatedBy`; feedback handling reserves `handledAt`, `handlerName`, and `resolutionNote`.
- MVP operator defaults to `demo-admin` until real login is added.
- Each writable module needs a save-refresh-read test across API and downstream reader where applicable.

## Consequences

Admin UI can stay simple, but backend contracts own data safety. Review and manager surfaces can rely on persisted audit fields and stable historical references later.
