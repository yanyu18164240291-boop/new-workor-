import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const governanceFiles = [
  '.agents/skills/haina-onboarding-h5/SKILL.md',
  '.agents/skills/haina-onboarding-h5/references/page-map.md',
  'docs/specs/phase-02-newcomer-permission-flow.md',
  'docs/specs/phase-06-final-qa.md',
  'docs/decisions/0001-one-click-apply-follow-up.md',
];

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('project governance guardrails', () => {
  it('documents that confirmed one-click permission apply creates persisted follow-up tasks', () => {
    const combined = governanceFiles.map(read).join('\n');

    assert.match(combined, /one-click permission application should also trigger the 4-hour follow-up rule|一键申请.*4-hour follow-up|One-click permission apply creates persisted 4-hour follow-up tasks/s);
    assert.match(combined, /does not call real Feishu|不调用真实飞书|No real Feishu/);
  });

  it('does not reintroduce the obsolete no-follow-up one-click rule', () => {
    const combined = governanceFiles.map(read).join('\n');

    assert.doesNotMatch(combined, new RegExp(['One-click apply', 'never triggers follow-up'].join(' ')));
    assert.doesNotMatch(combined, new RegExp(['No one-click permission apply', 'triggers 4-hour follow-up'].join(' ')));
    assert.doesNotMatch(combined, new RegExp(['Clicking “一键申请”', 'only updates permission application status', 'it does not trigger'].join('.*')));
  });
});
