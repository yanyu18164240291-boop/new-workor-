import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { getHomeShortcutItems } from '../src/frontend/routes.ts';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('newcomer page structure regressions', () => {
  it('keeps the home bot bubble, four entry cards, and collapsible progress card hooks', () => {
    const pages = source('src/frontend/pages/newcomerPages.tsx');

    assert.match(pages, /className="home-bot-row"/);
    assert.match(pages, /className="bot-bubble-card"/);
    assert.match(pages, /className="home-shortcut-row"/);
    assert.match(pages, /home-shortcut-card/);
    assert.match(pages, /className="home-progress-card"/);
    assert.match(pages, /className="home-progress-head"/);
    assert.equal(getHomeShortcutItems().length, 4);
  });

  it('keeps D1 arrows attached to the three key path cards without duplicate action rows', () => {
    const pages = source('src/frontend/pages/newcomerPages.tsx');
    const components = source('src/frontend/components.tsx');

    assert.match(pages, /<StepList showArrow hideStatus/);
    assert.doesNotMatch(pages, /className="d1-action-list"/);
    assert.match(components, /showArrow/);
    assert.match(components, /className="step-arrow"/);
    assert.match(components, /step-row-with-arrow/);
  });
});
