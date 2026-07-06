import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { buildHomeBotReply } from '../src/frontend/homeChatModel.ts';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('newcomer home chat input', () => {
  it('returns simulated bot replies for common onboarding questions', () => {
    assert.match(buildHomeBotReply('ChatGPT账号怎么申请？'), /权限申请/);
    assert.match(buildHomeBotReply('OA系统怎么登录？'), /OA/);
    assert.match(buildHomeBotReply('我今天应该先做什么？'), /D1/);
    assert.match(buildHomeBotReply('其他问题'), /演示版/);
  });

  it('keeps the home chat input editable and wired to send user text', () => {
    const page = source('src/frontend/pages/newcomerPages.tsx');
    const chatInputRow = page.match(/<div className="home-chat-input-row">[\s\S]*?<\/div>/)?.[0] ?? '';

    assert.doesNotMatch(chatInputRow, /readOnly/);
    assert.match(chatInputRow, /onChange=\{[\s\S]*setAnswer/);
    assert.match(chatInputRow, /onKeyDown=\{[\s\S]*handleSendHomeChat/);
    assert.match(chatInputRow, /onClick=\{handleSendHomeChat\}/);
    assert.match(page, /home-chat-thread/);
  });
});
