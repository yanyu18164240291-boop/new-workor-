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
- `src/server/routes/newcomerRoutes.ts`, `adminRoutes.ts`, `managerRoutes.ts`, and `reviewRoutes.ts` own only URL pattern to handler mapping for their product surfaces.
- `src/server/services/newcomerService.ts`, `adminService.ts`, `managerService.ts`, and `reviewService.ts` own SQL-backed request handling for their product surfaces.
- `src/server/repositories/configRepository.ts`, `feedbackRepository.ts`, `metricsRepository.ts`, and `permissionRepository.ts` own shared SQL helpers reused across product surfaces.

## Backend Routes Phase 3 Split

The backend route table is split by product surface:

- `src/server/routes/newcomerRoutes.ts`
- `src/server/routes/adminRoutes.ts`
- `src/server/routes/managerRoutes.ts`
- `src/server/routes/reviewRoutes.ts`

Keep cross-cutting validation and SQL serialization in `src/server/routeKit.ts`. Add a new route module only when a new product surface appears; add route handlers to the existing surface module when the API belongs to an existing page group.

## Backend Services Phase 4 Split

Route modules must stay declarative: regex pattern, HTTP method bucket, and named service handler. SQL, request mutation, persistence rules, and cross-table workflow updates belong in the matching service module. This keeps URL ownership separate from business workflow ownership and makes later repository extraction safer.

Shared SQL helpers belong in repository modules, not in `routeKit.ts`. `routeKit.ts` remains for request/response route types, JSON parsing, scalar validation, generated ids, time helpers, SQL scalar conversion, and row normalization only.

## Guardrails

Architecture tests should fail if page components move back into `App.tsx`, SQL route handlers move back into `src/server/app.ts`, route SQL handlers move back into the API aggregation file, SQL is reintroduced directly into `src/server/routes/*Routes.ts`, or shared SQL helpers drift back into `src/server/routeKit.ts`.
