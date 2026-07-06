# Phase 06 Engineering Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable engineering management artifacts and automated guardrails after the accepted Phase 06 newcomer-side bugfix rounds.

**Architecture:** Keep runtime behavior unchanged. Add repository documentation under `docs/qa/` and a focused governance test under `tests/` so future changes must preserve version traceability, smoke coverage, P0 data boundaries, and deployment rollback notes.

**Tech Stack:** Markdown, Node `node:test`, existing npm scripts.

---

### Task 1: Record Bugfix Ledger

**Files:**
- Create: `docs/qa/phase-06-bugfix-ledger.md`

- [x] **Step 1: Capture accepted bugfix rounds**

Record the Render demo branch, accepted commits `92ad992` and `f64ef8f`, verification commands, and no-`master` policy.

- [x] **Step 2: Verify ledger is referenced by tests**

Run: `node --test tests\phase06-engineering-closeout.test.ts`

Expected: initially fail until the ledger exists, then pass.

### Task 2: Record Engineering Closeout

**Files:**
- Create: `docs/qa/phase-06-engineering-closeout.md`

- [x] **Step 1: Document gates and smoke matrix**

Include `npm.cmd test`, `npm.cmd run build`, `git diff --check`, `git status --short --branch`, all three surfaces, P0 data tables, deployment runbook, access control, and risk table.

- [x] **Step 2: Verify closeout is test-covered**

Run: `node --test tests\phase06-engineering-closeout.test.ts`

Expected: pass once all required sections and route/test references exist.

### Task 3: Add Governance Test

**Files:**
- Create: `tests/phase06-engineering-closeout.test.ts`

- [x] **Step 1: Write documentation guardrail assertions**

Check both QA docs exist and include accepted branch, commits, smoke routes, automated test references, P0 tables, deployment runbook, access-control warnings, and non-goals.

- [x] **Step 2: Run focused test**

Run: `node --test tests\phase06-engineering-closeout.test.ts`

Expected: pass.

### Task 4: Final Verification

**Files:**
- No additional source files.

- [x] **Step 1: Run complete test suite**

Run: `npm.cmd test`

Expected: all tests pass.

- [x] **Step 2: Run production build**

Run: `npm.cmd run build`

Expected: TypeScript and Vite build pass.

- [x] **Step 3: Check diff and status**

Run:

```powershell
git diff --check
git status --short --branch
```

Expected: no whitespace errors; only the planned docs/test files are modified before commit.
