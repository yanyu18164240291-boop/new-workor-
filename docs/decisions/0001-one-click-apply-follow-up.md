# Decision 0001: One-Click Permission Apply Creates Follow-Up Tasks

## Context

The original phase spec said 4-hour follow-up tasks were created only after page 04 "我已提交". During product review, the user clarified that page 03 one-click permission application should also trigger the 4-hour follow-up rule after the newcomer confirms selected permissions.

## Decision

For the H5 MVP, confirmed one-click permission application on page 03 writes permission progress records and creates or reuses 4-hour follow-up tasks. It stays on page 03 and does not call real Feishu or approval APIs.

Page 04 "我已提交" keeps the same behavior: it writes permission progress, creates or reuses the follow-up task, then routes to page 05.

## Non-Goals

- No real approval submission.
- No real Feishu message sending.
- No real external reminder delivery.

## Engineering Guardrail

Tests should fail if project specs reintroduce obsolete no-follow-up wording for one-click apply or if UI copy claims the one-click path is frontend-only.
