# Phase 08B Spec: Coze Provider + Local RAG Fallback

## Goal

Keep the homepage AI Q&A API stable while allowing the backend to use the published Coze agent when configured. If the agent is unavailable, the answer must fall back to the local SQLite knowledge-base RAG from Phase 08. The original workflow API remains a compatibility path when no Bot ID is configured.

## Scope

- Fix admin access for real Feishu login by adding backend-controlled whitelist access.
- Keep `/admin-config` guarded, but allow pilot admins through `HAINA_ADMIN_OPEN_IDS`, `HAINA_ADMIN_USER_IDS`, or `HAINA_ADMIN_EMAILS`.
- Add a server-side Coze agent provider behind `POST /api/newcomers/:id/ai-chat`.
- Persist the Coze conversation ID per newcomer and Bot so follow-up questions keep the same agent context.
- Keep the frontend contract unchanged.
- Keep local RAG as the fallback path.

## Non-Scope

- Do not modify MySQL.
- Do not enter a real approval flow.
- Do not expose Coze tokens to frontend code.
- Do not call Coze from the browser.
- Do not add streaming UI in this small branch.

## Runtime Contract

- Coze agent chat is enabled when `COZE_API_TOKEN` and `COZE_BOT_ID` are configured.
- The backend creates a non-streaming `/v3/chat`, polls its status, and reads the final `assistant` / `answer` message.
- The first Bot request creates a Coze conversation. Later requests for the same newcomer and Bot call `/v3/chat?conversation_id=...`.
- Bot chat may wait up to 90 seconds because knowledge/database workflows can exceed 30 seconds.
- While a homepage question is pending, the frontend shows a retrieval state and blocks duplicate submission.
- When `COZE_BOT_ID` is absent, `COZE_API_TOKEN` plus `COZE_WORKFLOW_ID` keeps the original `/v1/workflow/run` compatibility path.
- Default API base: `https://api.coze.cn`.
- Optional overrides:
  - `COZE_API_BASE`
  - `COZE_APP_ID`
- Agent chat request body sent to Coze:
  - `bot_id`
  - `user_id`
  - `additional_messages[].content`
- Workflow compatibility request body sent to Coze:
  - `workflow_id`
  - `app_id` when configured
  - `parameters.question`
  - `parameters.newcomerId`
  - `parameters.roleId`
  - `parameters.localKnowledgeContext`
  - `parameters.citations`
- Successful Coze answer returns `mode: "coze"`.
- Timeout, network error, non-OK HTTP response, non-zero Coze `code`, failed chat status, or empty answer text returns to local RAG.
- Local RAG still returns `mode: "local_rag"` or `mode: "no_match"`.

## Admin Access Contract

- Backend computes `authSession.user.canAccessAdminConfig`.
- Frontend admin guard reads that backend flag before falling back to local demo-admin behavior.
- Existing demo admin headers remain for local tests and prototype usage.

## Acceptance Criteria

- A whitelisted real Feishu user can load and write admin config without department/job-title keyword matches.
- Homepage AI Q&A calls the published Coze agent when token and Bot ID are present.
- A Coze knowledge/database workflow that completes after 30 seconds still returns its final agent answer instead of local `no_match`.
- Consecutive questions from the same newcomer reuse the persisted Coze conversation ID.
- The homepage prevents duplicate questions while a Coze response is pending.
- Homepage AI Q&A keeps the direct workflow and local knowledge context path when only a Workflow ID is configured.
- Homepage AI Q&A falls back to local RAG when Coze fails.
- No real approval workflow is introduced.
- No MySQL migration is introduced.
- `npm.cmd test` passes.
- `npm.cmd run build` passes.
