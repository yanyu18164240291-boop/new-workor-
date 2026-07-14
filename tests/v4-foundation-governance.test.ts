import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('V4-00 product and engineering baseline', () => {
  it('treats the supplied permission assistant PRD as draft input', () => {
    const agents = read('AGENTS.md');
    const phase = read('docs/specs/phase-v4-00-product-engineering-baseline.md');

    assert.match(agents, /draft discovery input, not the final development PRD/i);
    assert.match(phase, /does not approve the draft as the final product specification/i);
    assert.match(phase, /Final PRD Readiness Gate/);
  });

  it('keeps real Feishu approval behind a future adapter boundary', () => {
    const agents = read('AGENTS.md');
    const decision = read('docs/decisions/permission-assistant-v4-baseline.md');
    const phase = read('docs/specs/phase-v4-00-product-engineering-baseline.md');

    assert.match(agents, /Real Feishu approval API integration is approved as a target capability/);
    assert.match(decision, /tests use a fake approval adapter/);
    assert.match(phase, /Real Feishu approval API requests/);
    assert.match(phase, /cannot be called by V4-00 code/);
  });

  it('uses additive migrations and preserves legacy rollback data', () => {
    const agents = read('AGENTS.md');
    const decision = read('docs/decisions/permission-assistant-v4-baseline.md');

    assert.match(agents, /Add new V4 migrations; never rewrite an applied migration/);
    assert.match(agents, /Do not drop, rename, or destructively rewrite legacy SQLite tables/);
    assert.match(decision, /Existing SQLite tables and records remain untouched by V4-00/);
    assert.match(decision, /382bf6b/);
  });

  it('prevents new V4 domain work from growing legacy onboarding services', () => {
    const agents = read('AGENTS.md');
    const skill = read('.agents/skills/haina-onboarding-h5/SKILL.md');

    assert.match(agents, /New V4 business logic must not be added to the legacy mixed onboarding services/);
    assert.match(skill, /Build new permission catalog, application, approval routing, entitlement, and audit modules outside legacy mixed onboarding services/);
  });
});
