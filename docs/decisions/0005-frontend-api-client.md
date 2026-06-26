# Decision 0005: Frontend API Client Errors

## Context

The backend now returns stable error payloads with `error` and `code`. The H5, admin, and manager surfaces should not parse backend failures differently or collapse network, validation, not-found, and invalid JSON failures into generic JavaScript errors.

## Decision

- `src/frontend/api.ts` owns the frontend API client and response envelope parsing.
- API calls throw `ApiClientError` with `status`, `code`, `path`, and `method`.
- `formatApiErrorMessage` maps technical errors into user-facing loading/action messages.
- Network failures are normalized to `NETWORK_ERROR`, so the shell can show a direct backend connection hint.
- Backend `error` remains the visible message for validation failures, preserving server-side contract details.

## Guardrails

Add API client tests when a new backend error code is introduced or a new frontend request helper is added. Page components should call methods on `api`; they should not call `fetch` directly.
