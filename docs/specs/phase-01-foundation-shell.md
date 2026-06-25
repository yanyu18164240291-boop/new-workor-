# Phase 01 Spec: Foundation Shell

## Goal

Create the runnable H5 MVP foundation with routing, backend data access boundaries, seeded demo data, mobile phone shell, shared UI primitives, and page placeholders for all 12 pages.

## Scope

Build the app structure, navigable shell, and backend client foundation. Detailed page interactions come in later phases.

## Functional Requirements

- App opens directly to page 01 新人首页, not a marketing page.
- Desktop viewport centers a phone-style prototype.
- Mobile viewport uses the prototype as the primary layout.
- All 12 routes exist and render their correct page number and title.
- Shared page frame includes status bar, app header, content area, and optional bottom actions or bottom nav.
- Backend seed data exists for newcomers, permission package, permission tasks, weekly feedbacks, anonymous feedbacks, knowledge base docs, and review metrics.
- Frontend pages read P0 demo data through an API client or data access layer, not hard-coded component state.

## Pages In This Phase

- Page 01 through Page 12 as route placeholders.
- Page placeholders should contain enough text to confirm the page purpose and route.

## Shared Components

- PageBoard
- PhoneFrame
- StatusBar
- AppHeader
- Card
- SectionCard
- StatusChip
- ActionButton
- BottomNav
- Toast
- Modal

## Seed Data Requirements

Include seed records equivalent to these domain collections:

- `newcomers`
- `permissionPackage`
- `permissionTasks`
- `weeklyFeedbacks`
- `newcomerFeedbackState`
- `anonymousFeedbacks`
- `knowledgeBaseDocs`
- `reviewMetrics`

## Acceptance Criteria

- All required routes load without blank screens.
- Page numbers match the final page map.
- Page 06 is “新人首周反馈填写”.
- Page 07 is “匿名反馈”.
- Page 12 is “管理者视角 / 新人首周反馈”.
- Desktop and mobile layouts do not overlap text or controls.
- Seed data can be reset and loaded without syntax errors.
- API client/data access layer has typed methods or clearly named functions for P0 data reads.
