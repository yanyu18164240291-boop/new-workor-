# Phase 08 Spec: Feishu Real Login

## Goal

Replace the demo-only identity entry with Feishu OAuth login while preserving current demo behavior when Feishu credentials are not configured.

## Scope

- Add Feishu OAuth start and callback routes.
- Store the Feishu login session in an HTTP-only cookie.
- Expose a session API for the H5 frontend.
- Keep approval submission and Bot message sending simulated in this phase.
- Keep local development runnable without Feishu credentials.

## Required Environment Variables

```text
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=...
FEISHU_REDIRECT_URI=https://haina-onboarding-h5-demo.onrender.com/api/auth/feishu/callback
FEISHU_TEST_NEWCOMER_ID=newcomer-yanyu
```

## Acceptance Criteria

- Without Feishu environment variables, `/api/auth/session` reports auth disabled and the app remains usable.
- With Feishu environment variables, the H5 redirects unauthenticated users to Feishu OAuth.
- The callback exchanges the authorization code for a Feishu user session.
- The app secret is never committed to the repository.
- Existing Phase 06 test and build gates still pass.
