# Phase 09 Spec: Product Scope Convergence

## Decision

After the product review, the active product contains only two surfaces:

- Newcomer H5.
- Admin configuration console.

The final page structure and interaction design for these two surfaces are intentionally deferred. This phase removes obsolete product modules without pre-committing the next information architecture.

## Removed Product Modules

- D1 guide page, configuration, automatic Feishu delivery, and admin resend.
- Weekly feedback page and admin question configuration.
- Anonymous feedback page, admin configuration, and feedback pool.
- V1 pilot review page.
- Manager overview, newcomer detail, and manager feedback pages.

Legacy URLs must not render removed content. They fall back to the newcomer home until the next page map is approved.

## Retained Runtime Scope

### Newcomer

- Home AI question answering.
- Permission package.
- Permission detail and progress registration.
- Permission follow-up.

### Admin

- Configuration overview limited to active modules.
- Role and permission package maintenance.
- Knowledge base maintenance.

This retained route list is an interim engineering boundary, not the final product page map.

## Backend Boundary

- Removed modules must have no registered public or admin API routes.
- D1 automatic or forced message delivery must not be triggerable.
- Manager API guards and routes must be removed with the manager surface.
- Active permission, AI/RAG, authentication, and admin permission/knowledge APIs remain unchanged.
- No real approval integration is added in this phase.

## Data Retention And Rollback

- Do not drop SQLite tables or delete historical D1, feedback, review, or manager records.
- Keep existing migrations compatible with deployed databases.
- Removed modules stop receiving new writes because their routes are unregistered.
- Database archival or physical deletion requires a separate approved migration after backup.
- The rollback boundary is the Phase 09 feature commit; no irreversible database migration is allowed.

## Acceptance Criteria

- Newcomer navigation contains no D1, weekly feedback, anonymous feedback, review, or manager entry.
- Admin navigation contains only overview, role/permission packages, and knowledge base.
- Removed frontend routes are absent from the active route contract.
- Removed frontend pages and isolated manager/review/admin-tab components are deleted.
- Removed backend routes return `404` and cannot create new records or send D1 messages.
- Existing permission, AI/RAG, authentication, admin permission, and knowledge behavior remains covered by tests.
- Legacy SQLite tables and migrations remain intact.
- `npm.cmd test` and `npm.cmd run build` pass.

