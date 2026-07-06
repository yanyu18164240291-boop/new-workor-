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

  it('expands the home page into a focused chat mode after input focus', () => {
    const page = source('src/frontend/pages/newcomerPages.tsx');
    const styles = source('src/frontend/styles.css');

    assert.match(page, /const \[isHomeChatActive, setIsHomeChatActive\] = useState\(false\)/);
    assert.match(page, /const \[progressCollapsed, setProgressCollapsed\] = useState\(true\)/);
    assert.match(page, /homeOpeningMessage/);
    assert.match(page, /visibleHomeChatMessages/);
    assert.match(page, /!\s*isHomeChatActive && \(/);
    assert.match(page, /home-content-pad-chatting/);
    assert.match(page, /home-fixed-chat-chatting/);
    assert.match(page, /onFocus=\{\(\) => setIsHomeChatActive\(true\)\}/);
    assert.match(styles, /\.home-content-pad-chatting\s*\{[\s\S]*?overflow:\s*hidden/);
    assert.match(styles, /\.home-fixed-chat-chatting\s*\{[\s\S]*?top:\s*176px/);
    assert.match(styles, /\.home-fixed-chat-chatting \.home-chat-thread\s*\{[\s\S]*?flex:\s*1/);
    assert.match(styles, /\.home-fixed-chat-chatting \.quick-chip-row\s*\{[\s\S]*?display:\s*none/);
  });
});
