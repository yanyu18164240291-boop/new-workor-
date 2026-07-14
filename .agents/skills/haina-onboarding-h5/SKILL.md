---
name: haina-onboarding-h5
description: Use when planning, developing, reviewing, migrating, or QAing the Haina permission assistant transition in this repository. Applies to V4 draft governance, retained Feishu/auth/runtime foundations, permission-domain boundaries, additive migrations, real Feishu approval adapters, and legacy onboarding compatibility.
---

# 海纳权限助手 V4 过渡开发 Skill

## Purpose

Keep work in this repository aligned while the product transitions from the legacy onboarding H5 to the proposed employee permission assistant.

The current product document is a draft. Do not convert draft examples into permanent routes, schemas, status enums, or UI acceptance criteria before the user supplies and approves the final development PRD.

## Always Start Here

1. Read `AGENTS.md`.
2. Read `docs/decisions/permission-assistant-v4-baseline.md`.
3. Read `docs/specs/phase-v4-00-product-engineering-baseline.md`.
4. Read the relevant approved V4 phase spec.
5. Treat Phase 00-09 onboarding documents as historical unless an active V4 document explicitly references them.

## Current Boundary

- Only V4-00 governance and engineering baseline work is approved now.
- The final employee/admin page design is not frozen.
- Existing AI/RAG, knowledge, permission, and follow-up runtime code is interim, not a promise to keep those capabilities in final V4.
- Do not restore D1, weekly feedback, anonymous feedback, review, or manager runtime modules.
- Preserve legacy SQLite data for rollback and audit compatibility.

## Confirmed Integration Direction

- Continue to use real Feishu login for identity.
- System-supplied employee and organization data replaces user-entered approvers.
- Real Feishu approval API calls are allowed in a later integration phase.
- Put Feishu approval behind an adapter; domain services must not import provider-specific HTTP behavior.
- Do not send real approval requests until approval definition identifiers, scopes, credentials, callback/event rules, test users, and acceptance cases are approved.
- Permission activation and revocation remain administrator-recorded until target-system integrations are separately approved.

## Architecture Guardrails

- Build new permission catalog, application, approval routing, entitlement, and audit modules outside legacy mixed onboarding services.
- Keep provider APIs behind adapters and persist provider request IDs, instance IDs, status events, and failures without exposing secrets.
- Use additive migrations and retain legacy tables. No destructive migration in the V4 foundation phase.
- Keep core workflows deterministic and testable without Feishu network access.
- Validate all writes on the backend and preserve save-refresh behavior.

## Phase Workflow

Before implementation, every phase must define:

- Included and excluded product behavior.
- Data ownership and lifecycle.
- API and integration boundaries.
- Migration and rollback behavior.
- Automated acceptance tests.
- Manual mobile/admin verification where relevant.

After implementation, run the full test suite and production build. Do not merge or deploy merely because a draft prototype renders.

## Reference

`references/page-map.md` documents the legacy onboarding route map only. Do not use it to infer the final V4 page map.
