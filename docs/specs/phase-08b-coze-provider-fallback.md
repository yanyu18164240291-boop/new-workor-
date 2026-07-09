# Phase 08B Spec: Coze Provider + Local RAG Fallback

## Goal

Keep the homepage AI Q&A API stable while allowing the backend to use the existing Coze workflow when configured. If Coze is unavailable, the answer must fall back to the local SQLite knowledge-base RAG from Phase 08.

## Scope

- Fix admin access for real Feishu login by adding backend-controlled whitelist access.
- Keep `/admin-config` guarded, but allow pilot admins through `HAINA_ADMIN_OPEN_IDS`, `HAINA_ADMIN_USER_IDS`, or `HAINA_ADMIN_EMAILS`.
- Add a server-side Coze workflow provider behind `POST /api/newcomers/:id/ai-chat`.
- Keep the frontend contract unchanged.
- Keep local RAG as the fallback path.

## Non-Scope

- Do not modify MySQL.
- Do not enter a real approval flow.
- Do not expose Coze tokens to frontend code.
- Do not call Coze from the browser.
- Do not add streaming UI in this small branch.

## Runtime Contract

- Coze is enabled only when `COZE_API_TOKEN` and `COZE_WORKFLOW_ID` are configured.
- Default endpoint: `https://api.coze.cn/v1/workflow/run`.
- Optional overrides:
  - `COZE_API_BASE`
  - `COZE_APP_ID`
- Request body sent to Coze:
  - `workflow_id`
  - `app_id` when configured
  - `parameters.question`
  - `parameters.newcomerId`
  - `parameters.roleId`
  - `parameters.localKnowledgeContext`
  - `parameters.citations`
- Successful Coze answer returns `mode: "coze"`.
- Timeout, network error, non-OK HTTP response, non-zero Coze `code`, or empty answer text returns to local RAG.
- Local RAG still returns `mode: "local_rag"` or `mode: "no_match"`.

## Admin Access Contract

- Backend computes `authSession.user.canAccessAdminConfig`.
- Frontend admin guard reads that backend flag before falling back to local demo-admin behavior.
- Existing demo admin headers remain for local tests and prototype usage.

## Acceptance Criteria

- A whitelisted real Feishu user can load and write admin config without department/job-title keyword matches.
- Homepage AI Q&A calls Coze when Coze env vars are present.
- Homepage AI Q&A sends local knowledge context to Coze.
- Homepage AI Q&A falls back to local RAG when Coze fails.
- No real approval workflow is introduced.
- No MySQL migration is introduced.
- `npm.cmd test` passes.
- `npm.cmd run build` passes.
