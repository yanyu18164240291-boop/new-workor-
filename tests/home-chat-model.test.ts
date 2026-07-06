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
    assert.match(styles, /\.home-fixed-chat-chatting\s*\{[\s\S]*?top:\s*148px/);
    assert.match(styles, /\.home-fixed-chat-chatting \.home-chat-thread\s*\{[\s\S]*?flex:\s*1/);
    assert.match(styles, /\.home-fixed-chat-chatting \.quick-chip-row\s*\{[\s\S]*?display:\s*none/);
  });

  it('shows bot and newcomer avatars in focused chat messages', () => {
    const page = source('src/frontend/pages/newcomerPages.tsx');
    const styles = source('src/frontend/styles.css');

    assert.match(page, /home-chat-avatar/);
    assert.match(page, /home-chat-avatar-\$\{message\.role\}/);
    assert.match(page, /message\.role === 'bot' \? '海' : '我'/);
    assert.match(page, /home-chat-message-bubble/);
    assert.match(styles, /\.home-chat-avatar\s*\{[\s\S]*?border-radius:\s*50%/);
    assert.match(styles, /\.home-chat-message-user \.home-chat-avatar\s*\{[\s\S]*?order:\s*2/);
    assert.match(styles, /\.home-chat-message-bot \.home-chat-avatar\s*\{[\s\S]*?background:\s*linear-gradient/);
  });

  it('does not render a simulated phone status bar above the app header', () => {
    const app = source('src/frontend/App.tsx');
    const components = source('src/frontend/components.tsx');
    const styles = source('src/frontend/styles.css');

    assert.doesNotMatch(app, /StatusBar/);
    assert.doesNotMatch(components, /function StatusBar/);
    assert.doesNotMatch(components, /className="status-bar"/);
    assert.doesNotMatch(styles, /\.status-bar/);
    assert.doesNotMatch(styles, /\.status-icons/);
  });

  it('wires home search, history, and attachment actions to visible panels', () => {
    const page = source('src/frontend/pages/newcomerPages.tsx');
    const components = source('src/frontend/components.tsx');
    const styles = source('src/frontend/styles.css');

    assert.match(components, /onHomeSearch/);
    assert.match(components, /onHomeHistory/);
    assert.match(page, /homeSearchQuery/);
    assert.match(page, /homeSearchResults/);
    assert.match(page, /homeHistoryItems/);
    assert.match(page, /selectedHistory/);
    assert.match(page, /showAttachSheet/);
    assert.match(page, /home-chat-panel home-search-panel/);
    assert.match(page, /home-chat-panel home-history-panel/);
    assert.match(page, /home-attach-sheet/);
    assert.match(styles, /\.home-chat-panel\s*\{/);
    assert.match(styles, /\.home-attach-grid\s*\{/);
  });
});
