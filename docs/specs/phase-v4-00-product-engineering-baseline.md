# Phase V4-00: Product And Engineering Baseline

## Status

Approved for execution on 2026-07-14.

The supplied permission-assistant PRD is a draft. This phase records decisions and prevents premature implementation. It does not approve the draft as the final product specification.

## Objective

Create a stable transition boundary from the onboarding H5 to the proposed permission assistant while preserving reusable platform capabilities, legacy data, and rollback options.

## In Scope

- Preserve the legacy-module convergence as a dedicated commit.
- Establish the V4 foundation branch and source-of-truth order.
- Record retained, replaced, archived, and deferred capabilities.
- Define feature-oriented module ownership.
- Define additive migration and rollback rules.
- Record real Feishu approval as an approved adapter-based integration direction.
- Record open product decisions that must be answered by the final PRD.
- Add governance tests that prevent draft requirements from becoming implementation commitments.

## Out Of Scope

- Final employee or admin page map.
- Final permission fields, status enums, routing rules, or form rules.
- New V4 database tables or APIs.
- Real Feishu approval API requests.
- Feishu organization synchronization beyond the existing login capability.
- Automatic permission provisioning or revocation.
- MySQL or other production database migration.
- Further AI/Coze/RAG development.
- Production merge or deployment.

## Final PRD Readiness Gate

Before the first V4 product implementation phase starts, the final PRD must state:

1. Which employee and administrator experiences are V1 requirements.
2. Which employee and organization fields come from Feishu or another source.
3. Whether one user submission creates one or multiple Feishu approval instances.
4. How permissions with different approval routes are grouped.
5. The business meaning and transition rule for every user-visible application status.
6. Who may withdraw, supplement, reject, resubmit, activate, expire, renew, and revoke.
7. How department administrators are scoped and what they may configure.
8. Which notifications and reminders are V1 requirements.
9. Which behavior remains manual when an external system is unavailable.
10. The V1 acceptance scenarios and explicit non-goals.

Missing provider protocol details do not block product approval, but the business action, state, owner, and visible result must be unambiguous.

## Provisional Delivery Sequence

The sequence is planning guidance and may change after the final PRD:

1. V4-01 domain contracts and additive schema.
2. V4-02 permission catalog and administrator configuration.
3. V4-03 application cart, validation, draft, and submission.
4. V4-04 routing preview, sub-application grouping, and Feishu approval adapter.
5. V4-05 application history, status timeline, renewal, and expiry.
6. V4-06 audit, notifications, pilot migration, and operational readiness.

Each phase requires its own approved spec before coding.

## Acceptance Criteria

- `AGENTS.md` identifies the draft PRD as non-final and defines the V4 source of truth.
- The project skill points to V4-00 and no longer treats the legacy onboarding PRD as active.
- The repository decision, integration boundary, data safety rules, and rollback checkpoint are documented.
- Real Feishu approval is allowed only through a future adapter phase and cannot be called by V4-00 code.
- No page, API, database migration, or runtime behavior is added for draft V4 requirements.
- Legacy database tables are not removed or modified.
- Governance tests, the full existing test suite, and the production build pass.
- The branch remains unmerged and undeployed.
