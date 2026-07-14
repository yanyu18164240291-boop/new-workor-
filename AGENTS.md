# AGENTS.md

## Project

This repository is transitioning from the legacy 海纳 AI 入职 Bot H5 into the proposed 海纳权限助手 V4.

The latest product document supplied by the user is a draft discovery input, not the final development PRD. Until the user supplies and approves the final PRD, do not treat draft page details, field lists, statuses, or workflow examples as frozen acceptance criteria.

## Required Project Skill

Before planning or implementing project work, read:

1. `.agents/skills/haina-onboarding-h5/SKILL.md`
2. `docs/decisions/permission-assistant-v4-baseline.md`
3. `docs/specs/phase-v4-00-product-engineering-baseline.md`
4. The relevant later V4 phase spec, once approved

## Source Of Truth

Priority order:

1. The user's latest explicit instruction.
2. The final 海纳权限助手 V4 PRD after the user explicitly marks it final.
3. Approved V4 decision records and phase specs.
4. Existing implementation and tests for retained platform capabilities.
5. Legacy onboarding PRDs and Phase 00-09 specs as historical evidence only.

If the final PRD conflicts with a V4 decision or phase spec, stop implementation and reconcile the conflict in documentation and tests first.

## Current Engineering State

- Commit `382bf6b` is the reversible legacy-module convergence checkpoint.
- The active work is isolated on `codex/permission-assistant-v4-foundation`.
- The runtime still contains interim permission, AI/RAG, knowledge, and follow-up behavior. That runtime is not the final V4 product definition.
- Do not merge or deploy the V4 foundation branch until its phase acceptance criteria pass and the user approves the merge.

## Confirmed V4-00 Decisions

- Continue in this repository; do not create a separate product repository.
- Reuse Feishu login, admin authentication, runtime, deployment, database migration, and test foundations.
- Employee identity and organization fields are system supplied; users do not enter approvers manually.
- Real Feishu approval API integration is approved as a target capability.
- Real approval calls must be implemented behind a dedicated adapter after the final approval definition, credentials/scopes, test tenant, callback behavior, and acceptance cases are available.
- Before real provisioning integrations exist, administrators record permission activation, failure, expiry, and revocation outcomes.
- Database migration to MySQL or another production database remains a separate infrastructure phase.

## V4-00 Hard Boundaries

- Do not finalize the employee or admin page map from the draft PRD.
- Do not implement new V4 product pages or domain tables in V4-00.
- Do not call the real Feishu approval API in V4-00.
- Do not drop, rename, or destructively rewrite legacy SQLite tables.
- Do not restore removed D1, weekly feedback, anonymous feedback, review, or manager modules.
- Do not expand AI/Coze/RAG work; its final archive/removal decision is deferred to the final PRD baseline.
- Keep the app buildable and the active runtime regression suite passing.

## Architecture Direction

New V4 business logic must not be added to the legacy mixed onboarding services. Use feature-oriented boundaries:

```text
src/server/modules/permission-catalog
src/server/modules/applications
src/server/modules/approval-routing
src/server/modules/entitlements
src/server/modules/audit
src/server/integrations/feishu-approval
src/frontend/features/permission-center
src/frontend/features/my-applications
src/frontend/features/admin-permissions
```

External approval, notification, provisioning, and organization systems must be accessed through adapters. Core application state must remain testable without network access.

## Data And Migration Discipline

- Add new V4 migrations; never rewrite an applied migration.
- Preserve legacy tables and records until a separately approved backup and archival migration exists.
- Do not overload legacy `newcomers`, `permission_progress`, or `follow_up_tasks` with the new application aggregate.
- Define the V4 application aggregate, item/sub-application split, approval events, entitlements, dynamic form values, and audit records in a later approved phase.
- Every write path must support save-refresh persistence, backend validation, audit identity, and deterministic tests.

## Delivery Discipline

For every V4 phase:

1. Freeze the phase scope and acceptance criteria before coding.
2. Keep one concern per commit where practical.
3. Add or update regression tests with the behavior change.
4. Run the full test suite and production build.
5. Verify migration compatibility and rollback boundaries.
6. Merge only after review and explicit approval.

## Historical Material

The legacy source PRD, 12-page route map, onboarding phase specs, Coze/RAG phase, D1 delivery, feedback, review, and manager requirements are retained for traceability. They are not active V4 requirements unless the user reintroduces them in the final PRD.
