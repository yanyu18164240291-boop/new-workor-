import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { getHomeShortcutItems } from '../src/frontend/routes.ts';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('newcomer page structure regressions', () => {
  it('keeps the home bot bubble, compact nav, and collapsible progress card hooks', () => {
    const pages = source('src/frontend/pages/newcomerPages.tsx');

    assert.match(pages, /className="home-bot-row"/);
    assert.match(pages, /className="bot-bubble-card"/);
    assert.match(pages, /className="home-greeting-line"/);
    assert.match(pages, /className="home-quick-nav"/);
    assert.match(pages, /home-quick-nav-item/);
    assert.doesNotMatch(pages, /className="home-shortcut-row"/);
    assert.doesNotMatch(pages, /home-shortcut-card/);
    assert.match(pages, /className="home-progress-card"/);
    assert.match(pages, /className="home-progress-head"/);
    assert.equal(getHomeShortcutItems().length, 4);
  });

  it('builds the home greeting from Feishu session first and newcomer data as fallback', () => {
    const pages = source('src/frontend/pages/newcomerPages.tsx');
    const state = source('src/frontend/appState.ts');
    const data = source('src/frontend/dashboardData.ts');

    assert.match(state, /api\.getAuthSession\(\)/);
    assert.match(data, /authSession\?: AuthSession/);
    assert.match(pages, /data\.authSession\?\.user\?\.name/);
    assert.match(pages, /data\.authSession\?\.user\?\.departmentName/);
    assert.match(pages, /data\.authSession\?\.user\?\.jobTitle/);
    assert.match(pages, /welcomeHeadline/);
    assert.match(pages, /welcomeBody/);
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

  it('keeps StepList keys stable when several steps share the same visible day label', () => {
    const components = source('src/frontend/components.tsx');

    assert.match(components, /const rowKey = `\$\{step\.no\}-\$\{step\.title\}`/);
    assert.doesNotMatch(components, /key=\{step\.no\}/);
  });

  it('keeps admin date and weekly sort controls visibly labeled', () => {
    const styles = source('src/frontend/styles.css');
    const weeklyTab = source('src/frontend/pages/AdminConfig/WeeklyFeedbackTab.tsx');

    assert.match(styles, /\.admin-workbench-date-filter\s*\{[\s\S]*flex:\s*0 0 auto/);
    assert.match(styles, /\.admin-workbench-date-filter input\s*\{[\s\S]*width:\s*122px/);
    assert.match(weeklyTab, /key:\s*'sort'[\s\S]*title:\s*'排序'/);
  });

  it('keeps home preset questions in focused chat cards without bottom dock styling', () => {
    const styles = source('src/frontend/styles.css');
    const questionCardRule = styles.match(/\.home-suggested-question-card strong\s*\{[\s\S]*?\}/)?.[0] ?? '';

    assert.doesNotMatch(styles, /\.home-fixed-chat \.quick-chip-row/);
    assert.match(styles, /\.home-suggested-questions\s*\{/);
    assert.doesNotMatch(questionCardRule, /text-overflow:\s*ellipsis/);
  });

  it('keeps cached surface data visible while background refresh runs', () => {
    const state = source('src/frontend/appState.ts');
    const app = source('src/frontend/App.tsx');

    assert.match(state, /const dashboardDataCache = new Map<string, DashboardData>\(\)/);
    assert.match(state, /getDashboardCacheKey/);
    assert.match(state, /cachedData/);
    assert.match(state, /setStatus\('loading'\)/);
    assert.match(state, /if \(!cachedData\) \{/);
    assert.match(app, /const canRenderContent = status === 'ready' \|\| Boolean\(data\.__staleWhileRevalidate\)/);
    assert.match(app, /<LoadingState status=\{canRenderContent \? 'ready' : status\} error=\{error\} \/>/);
  });

  it('marks required weekly feedback question titles with the same red star style as anonymous feedback', () => {
    const pages = source('src/frontend/pages/newcomerPages.tsx');

    assert.match(pages, /function weeklyQuestionTitle\(question: WeeklyFeedbackQuestion\)/);
    assert.match(pages, /const weeklyRequiredStarQuestionKeys = new Set\(\['overall_feeling', 'message', 'work_summary'\]\)/);
    assert.match(pages, /question\.required && weeklyRequiredStarQuestionKeys\.has\(question\.questionKey\) && <span className="required-star">\*<\/span>/);
    assert.match(pages, /<SectionCard title=\{weeklyQuestionTitle\(question\)\} key=\{question\.id\}>/);
  });

  it('validates weekly feedback required text fields before submitting', () => {
    const pages = source('src/frontend/pages/newcomerPages.tsx');

    assert.match(pages, /findMissingWeeklyRequiredQuestion\(questions,\s*selectedByQuestion,\s*textByQuestion\)/);
    assert.doesNotMatch(pages, /questions\.find\(\(question\) => question\.required && question\.inputType !== 'text'/);
  });
});
