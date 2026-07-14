# Permission Assistant V4 Engineering Baseline

Status: approved engineering direction; product requirements remain draft.

Date: 2026-07-14

## Decision

Continue in the existing repository and establish a new permission-assistant business architecture. Do not create a separate project and do not continue expanding the legacy onboarding domain model.

The draft product direction changes the product from a newcomer onboarding assistant to an employee permission application and management tool. The final PRD has not yet been supplied, so this decision freezes engineering boundaries only, not the final page map, field set, status model, or release scope.

## Confirmed Product Boundaries

- Employee-facing and administrator-facing surfaces remain the only product roles under consideration.
- Employee identity, department, position, reporting manager, and approval actors are supplied by trusted systems rather than manually entered by the applicant.
- Real Feishu approval API submission is an approved target capability.
- Permission activation, failure, expiry, and revocation are recorded by administrators until target-system provisioning integrations are separately approved.
- MySQL or another production database migration is not part of V4-00.

## Repository Decision

Retain and reuse:

- Feishu login and session handling.
- Administrator authentication and allow-list behavior.
- React/Vite frontend runtime and mobile/admin shells.
- Node API routing, validation, error envelopes, environment loading, and production serving.
- Render deployment configuration.
- Database migration runner, SQLite compatibility tests, and test harness.

Replace or isolate:

- The `newcomers` identity model with an employee-oriented model in a later migration.
- Required/optional role packages with a system/module/permission-point catalog.
- `permission_progress` and 4-hour follow-up state with application aggregates and approval/provisioning events.
- Mixed onboarding services with feature-oriented permission modules.
- Direct provider behavior with explicit integration adapters.

Archive from the final V4 runtime unless the final PRD reintroduces it:

- D1 and first-week onboarding flows.
- Weekly and anonymous feedback.
- Manager and review surfaces.
- Homepage AI/Coze/RAG and knowledge-base administration.
- Four-hour permission follow-up.

## Architecture Boundary

The intended module ownership is:

```text
permission-catalog  systems, modules, permission points, categories, visibility
applications       drafts, application items, validation, submission, resubmission
approval-routing   route rules, route preview, sub-application grouping, approval events
entitlements       owned permissions, effective dates, expiry, renewal, revocation
audit              configuration and business-operation history
integrations       Feishu approval, organization, notification, and provisioning adapters
```

Core domain modules may depend on adapter interfaces. They must not depend on Feishu HTTP payloads, credentials, or callback formats.

## Real Feishu Approval Boundary

V4-00 authorizes the direction, not live calls. A later integration phase must provide:

- The approved Feishu approval definition and version.
- Required application scopes and tenant authorization.
- Field mapping between the V4 application and Feishu form controls.
- Applicant, approver, and department identity mapping.
- Idempotency and duplicate-submission rules.
- Approval instance ID persistence.
- Callback or event subscription behavior.
- Status reconciliation and retry rules.
- Test tenant/users and acceptance scenarios.
- Secret management and log-redaction requirements.

Until those materials exist, tests use a fake approval adapter and production code must not issue real approval requests.

## Data Safety

- Existing SQLite tables and records remain untouched by V4-00.
- New V4 tables will be introduced through additive migrations after the final PRD data model is approved.
- Applied migrations are immutable.
- Physical deletion or archival requires a backup, migration plan, verification query, and rollback decision.
- The database technology migration remains a separate branch and acceptance gate.

## Branch And Rollback

- `382bf6b` is the legacy-module convergence checkpoint.
- Active V4 foundation branch: `codex/permission-assistant-v4-foundation`.
- V4-00 is documentation and governance only.
- No merge to `master` and no deployment occurs without explicit approval.
