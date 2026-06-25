# Phase 06 Spec: Final QA And Delivery

## Goal

Perform the final consistency, interaction, backend persistence, visual, and PRD-alignment pass before handing the H5 MVP to stakeholders.

## Scope

This phase covers the whole app.

## Consistency Checks

- Page list has exactly 12 pages.
- Page route, title, and page number match the PRD.
- Page 06 is weekly feedback form.
- Page 07 is anonymous feedback.
- Page 12 is manager weekly feedback view.
- Routes match `AGENTS.md`.
- Database table names and API field names are consistent across pages.
- No old `weeklyFeedback` single-object assumption remains if implementation uses `weekly_feedbacks` / `weeklyFeedbacks`.
- No real API call exists for knowledge answers.
- One-click permission apply creates persisted 4-hour follow-up tasks without calling real approval or Feishu APIs.
- P0 persistence uses backend/database rather than browser-only state.

## Interaction Checks

Verify these flows end-to-end:

- Page 01 -> Page 02 -> Page 03.
- Page 03 one-click apply stays on Page 03 and persists status.
- Page 03 one-click apply persists follow-up task records and reload preserves them.
- Page 03 “查看详情” -> Page 04.
- Page 04 “我已提交” -> Page 05.
- Refresh after Page 04 “我已提交” keeps the persisted permission progress and follow-up task.
- Page 05 “匿名反馈” -> Page 07.
- Page 01 D6/D7 weekly entry -> Page 06 -> submit -> Page 01.
- Refresh after weekly feedback submit keeps the submitted state.
- Page 10 newcomer -> Page 11 -> Page 12.
- Page 12 manager actions persist after refresh.
- Page 10 bottom “反馈” -> Page 12 or empty toast.
- Page 09 -> Page 08 knowledge / feedback tabs.

## Backend Checks

- Database migrations run from a clean database.
- Seed script can reset and recreate pilot demo data.
- API validation rejects invalid page 06 and page 07 submissions.
- `anonymous_feedbacks` contains submitted anonymous feedback.
- `weekly_feedbacks` contains submitted weekly feedback.
- `permission_progress` and `follow_up_tasks` are written after “我已提交” and after confirmed one-click permission application selections.
- `manager_feedback_actions` records manager view/action state.
- Admin configuration tables can be read and updated by page 08.
- Page reloads do not lose P0 state.

## Visual Checks

- Mobile layout is primary and polished.
- Desktop layout centers the phone prototype.
- Text does not overlap controls.
- Buttons fit their labels.
- Cards and sections preserve blue/white Feishu mobile style.
- Status colors are consistent:
  - Green: success/completed/submitted.
  - Orange: pending/waiting/attention.
  - Red: risk/error.
  - Purple: AI/knowledge/feedback secondary cue.

## Content Checks

- Page copy is short enough for mobile.
- Manager pages do not mention绩效评价 as a feature.
- Feedback pages explicitly say feedback is not for绩效评价.
- Anonymous feedback copy does not imply managers can view原文.
- Weekly feedback copy clearly says it is visible to managers.

## Technical Checks

- App builds successfully.
- App runs locally.
- No console errors on primary flows.
- No missing route produces a blank screen.
- Seed data loads successfully.
- P0 API responses are stable and validated.
- Form validation works for page 06 and page 07.
- Toasts and modals close cleanly.

## Delivery Criteria

- All phase specs are satisfied.
- Final PRD conflicts are resolved or documented.
- P0 backend MVP can support a small pilot with real persisted data.
- The MVP can be demoed from a clean local start.
- The repository contains no temporary scripts or throwaway files.
