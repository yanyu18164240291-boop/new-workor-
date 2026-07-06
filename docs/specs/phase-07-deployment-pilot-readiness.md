# Phase 07 Spec: Deployment Pilot Readiness

## Goal

Prepare the Haina onboarding H5 MVP for a small internal pilot deployment without expanding product scope or connecting real Feishu, approval, RAG, upload parsing, or message-sending integrations.

## Scope

This phase covers deployment readiness only:

- Runtime topology.
- Environment configuration.
- Database path, backup, migration, and rollback.
- Minimal access control for admin and manager surfaces.
- HTTPS / domain or internal network access.
- Process supervision and logs.
- Deployment runbook.

This phase does not connect real Feishu APIs, real approval APIs, real RAG, real upload parsing, or real message sending.

## Deployment Boundary

The MVP may be deployed for:

- Product review.
- Leadership demo.
- Internal pilot rehearsal.
- Small controlled trial with known users.

The MVP is not ready for open production use until real authentication, operational monitoring, data retention policy, and external integration ownership are defined.

## Required Decisions Before Execution

Before running any deployment command, confirm these with the user:

1. Deployment target:
   - Local LAN machine.
   - Internal server.
   - Cloud VM.
   - Static frontend + Node API host.
2. Access model:
   - Demo header retained behind network restriction.
   - Simple shared password / reverse proxy auth.
   - Real SSO deferred to later Feishu phase.
3. Data model:
   - Fresh pilot database.
   - Copy existing demo database.
   - Reset seed before each demo.
4. Exposure:
   - Localhost only.
   - Intranet only.
   - Public HTTPS domain.
5. Owner:
   - Who operates admin config.
   - Who can view manager pages.
   - Who can reset or back up the database.

## Readiness Tasks

### 1. Deployment Topology

- Decide how frontend and backend are served:
  - Vite dev server is not acceptable for pilot deployment.
  - Frontend should be built with `npm.cmd run build`.
  - Node API should run as a supervised process.
- Document expected ports and reverse proxy behavior.
- Ensure `/api/*` reaches the Node backend.

### 2. Environment Configuration

- Define environment variables:
  - `API_PORT`
  - `HAINA_DB_PATH`
  - future `HAINA_ALLOWED_ORIGIN`
  - future admin/manager access guard variables if added
- Keep local dev defaults working.
- Document pilot environment values in a non-secret example file or runbook.

### 3. Database Operations

- Use an explicit SQLite path outside transient build folders.
- Verify migrations run from a clean database.
- Verify seed/repair logic is repeatable.
- Add a backup command before every pilot run.
- Add a restore procedure.
- Document which data can be reset and which data should be retained.

### 4. Access Control

Current app uses demo headers in the frontend API client. Before pilot exposure:

- Do not expose admin and manager pages publicly without a network or proxy guard.
- Keep newcomer, admin, and manager surfaces separated.
- Preserve backend guards for `/api/admin/*`, `/api/admin-config/*`, and `/api/manager/*`.
- If using a reverse proxy, require a simple access gate for `/admin-config`, `/review`, and `/manager`.

### 5. HTTPS And Mobile Access

- Confirm whether the pilot uses intranet HTTP or HTTPS.
- For public or cross-device access, use HTTPS.
- Test the H5 on an actual mobile browser or Feishu container only after the URL is stable.
- Keep the blue/white Feishu-style mobile card UI unchanged.

### 6. Process Supervision And Logs

- Run the API with a supervisor or service manager instead of an interactive shell.
- Capture stdout/stderr logs.
- Document restart command.
- Document health check:
  - `GET /api/roles`
  - `GET /api/weekly-feedback-config`
  - `GET /api/anonymous-feedback-config`

### 7. Final Pilot Smoke Test

After deployment, verify:

- `/` loads on mobile.
- `/permissions` loads backend role package data.
- `/weekly-feedback` loads configured questions.
- `/anonymous-feedback` loads configured modules.
- `/admin-config` is guarded and reachable only by the intended operator.
- `/manager` is guarded and reachable only by the intended manager user.
- Page 03 one-click apply writes permission progress and follow-up tasks.
- Page 06 writes weekly feedback.
- Page 07 writes anonymous feedback.
- Page 12 manager action persists after refresh.

## Acceptance Criteria

- The app can be started from a clean checkout using documented commands.
- The frontend is served from a production build, not Vite dev mode.
- The API process can restart without losing SQLite data.
- The SQLite database path is explicit and backed up before pilot usage.
- Admin and manager surfaces are not exposed without a guard.
- Phase 06 test suite still passes.
- Phase 06 build still passes.
- The user has confirmed the deployment target and access model before any deployment is executed.

## Explicit Non-Goals

- Real Feishu app integration.
- Real Feishu login / OAuth / JS SDK integration.
- Real approval submission.
- Real Bot message sending.
- Real RAG or LLM integration.
- Real file upload parsing or vectorization.
- Public production launch.

## Feishu Integration Sequencing

Do not start real Feishu integration until this phase has a stable pilot URL and access model.

Recommended later order:

1. Feishu app entry opens the deployed H5.
2. Feishu identity / SSO replaces demo user assumptions.
3. Bot menu or message card links into the H5.
4. Event callbacks and message sending are added only after ownership, permissions, and audit rules are clear.

