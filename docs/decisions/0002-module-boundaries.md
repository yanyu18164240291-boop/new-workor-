# Decision 0002: Frontend And Backend Module Boundaries

## Context

The H5 MVP now covers newcomer, admin, review, and manager surfaces. Keeping all surfaces in `App.tsx` or all backend HTTP and SQL routing in `src/server/app.ts` made visual fixes and API changes too easy to couple.

## Decision

- `src/frontend/App.tsx` owns only shell composition, toast/modal state, and mobile/desktop surface selection.
- `src/frontend/AppContent.tsx` owns page-number dispatch.
- `src/frontend/appState.ts` owns browser path state and dashboard data loading.
- `src/frontend/pages/newcomerPages.tsx`, `adminPages.tsx`, and `managerPages.tsx` own their role-specific UI.
- `src/server/app.ts` owns only HTTP server concerns: CORS, JSON response writing, URL parsing, and lifecycle.
- `src/server/apiRoutes.ts` owns API route matching and SQL-backed handlers.

## Follow-Up Split

If `src/server/apiRoutes.ts` grows further, split route arrays by product surface:

- `src/server/routes/newcomerRoutes.ts`
- `src/server/routes/adminRoutes.ts`
- `src/server/routes/managerRoutes.ts`
- `src/server/routes/reviewRoutes.ts`

Keep shared validation and SQL serialization helpers in a small shared route-kit module before doing that split.

## Guardrails

Architecture tests should fail if page components move back into `App.tsx` or SQL route handlers move back into `src/server/app.ts`.
