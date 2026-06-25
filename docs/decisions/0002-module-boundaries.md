# Decision 0002: Frontend And Backend Module Boundaries

## Context

The H5 MVP now covers newcomer, admin, review, and manager surfaces. Keeping all surfaces in `App.tsx` or all backend HTTP and SQL routing in `src/server/app.ts` made visual fixes and API changes too easy to couple.

## Decision

- `src/frontend/App.tsx` owns only shell composition, toast/modal state, and mobile/desktop surface selection.
- `src/frontend/AppContent.tsx` owns page-number dispatch.
- `src/frontend/appState.ts` owns browser path state and dashboard data loading.
- `src/frontend/pages/newcomerPages.tsx`, `adminPages.tsx`, and `managerPages.tsx` own their role-specific UI.
- `src/server/app.ts` owns only HTTP server concerns: CORS, JSON response writing, URL parsing, and lifecycle.
- `src/server/apiRoutes.ts` owns only API route aggregation and matching.
- `src/server/routeKit.ts` owns shared route types, request parsing, SQL value serialization, and cross-surface data normalization helpers.
- `src/server/routes/newcomerRoutes.ts`, `adminRoutes.ts`, `managerRoutes.ts`, and `reviewRoutes.ts` own SQL-backed handlers for their product surfaces.

## Backend Routes Phase 3 Split

The backend route table is split by product surface:

- `src/server/routes/newcomerRoutes.ts`
- `src/server/routes/adminRoutes.ts`
- `src/server/routes/managerRoutes.ts`
- `src/server/routes/reviewRoutes.ts`

Keep cross-cutting validation and SQL serialization in `src/server/routeKit.ts`. Add a new route module only when a new product surface appears; add route handlers to the existing surface module when the API belongs to an existing page group.

## Guardrails

Architecture tests should fail if page components move back into `App.tsx`, SQL route handlers move back into `src/server/app.ts`, or route SQL handlers move back into the API aggregation file.
