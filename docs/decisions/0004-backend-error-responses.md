# Decision 0004: Backend Error Responses

## Context

The backend now has explicit contracts for core P0 state fields. Validation failures, not-found responses, malformed JSON, and unexpected failures need a stable shape so the H5 and admin surfaces can handle errors consistently during pilot usage.

## Decision

- `src/server/errors.ts` owns backend error classes and response payload helpers.
- Error responses keep the existing `error` string for compatibility and add a stable `code` field.
- Request validation and contract parsing must throw `ApiError` via helpers such as `badRequest`.
- Unexpected errors are mapped to `INTERNAL_ERROR` with HTTP 500.
- Route result errors without explicit codes are mapped by HTTP status through `inferErrorCode`.

## Guardrails

Add backend error tests for every new error category or persisted workflow validation rule. Do not throw raw `Error` from server-side validation paths; use typed helpers so HTTP responses remain predictable.
