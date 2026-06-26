# Decision 0003: Backend Contracts And Status Parsing

## Context

The backend now has route, service, and repository layers. P0 workflows depend on a small set of state strings for permission progress, task completion, follow-up handling, anonymous feedback, and manager actions. Leaving those strings inline in services makes later changes brittle.

## Decision

- `src/server/contracts.ts` owns backend API contract primitives and parsing helpers.
- Services must parse incoming status fields through contract helpers before writing to the database.
- Weekly feedback structured answers are filtered through `parseWeeklyAnswerInputs` before validation and persistence.
- Status unions should include seeded database values and UI-facing values together, so compatibility issues are caught by tests instead of runtime demos.

## Guardrails

Add contract tests whenever a new persisted status, structured request body, or cross-page API field is introduced. Do not widen these helpers to accept arbitrary strings unless the database schema itself is intentionally widened.
