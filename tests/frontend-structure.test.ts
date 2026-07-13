import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('newcomer page structure regressions', () => {
  it('hides secondary header actions on the four bottom-navigation task pages', () => {
    const components = source('src/frontend/components.tsx');

    assert.match(components, /hiddenSecondaryActionPageNos = new Set\(\['02', '03', '06', '07'\]\)/);
    assert.match(components, /!hideSecondaryActions &&/);
  });

  it('keeps the home bot bubble and collapsible progress card hooks without inline shortcut nav', () => {
    const pages = source('src/frontend/pages/newcomerPages.tsx');
    const styles = source('src/frontend/styles.css');

    assert.match(pages, /className="home-bot-row"/);
    assert.match(pages, /className="bot-bubble-card"/);
    assert.match(pages, /className="home-greeting-line"/);
    assert.doesNotMatch(pages, /className="home-quick-nav"/);
    assert.doesNotMatch(pages, /home-quick-nav-item/);
    assert.doesNotMatch(styles, /\.home-quick-nav/);
    assert.doesNotMatch(pages, /className="home-shortcut-row"/);
    assert.doesNotMatch(pages, /home-shortcut-card/);
    assert.match(pages, /className="home-progress-card"/);
    assert.match(pages, /className="home-progress-head"/);
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
    assert.match(pages, /triggerSource:\s*'d1_auto'/);
    assert.match(pages, /api\s*\.\s*sendD1GuideMessage/);
    assert.doesNotMatch(pages, /发送到飞书/);
    assert.doesNotMatch(pages, /d1-message-button/);
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

  it('keeps real Feishu D1 push controlled from admin instead of a newcomer test button', () => {
    const d1Tab = source('src/frontend/pages/AdminConfig/D1GuideTab.tsx');

    assert.match(d1Tab, /补发 D1 引导/);
    assert.match(d1Tab, /triggerSource:\s*'admin_resend'/);
    assert.match(d1Tab, /force:\s*true/);
  });

  it('keeps permission application out of the real approval flow for the current pilot', () => {
    const pages = source('src/frontend/pages/newcomerPages.tsx');
    const permissionDetail = pages.slice(pages.indexOf('export function PermissionDetailPage'), pages.indexOf('export function FollowUpPage'));

    assert.match(permissionDetail, /暂不打开审批/);
    assert.match(permissionDetail, /暂不进入真实审批流程/);
    assert.doesNotMatch(permissionDetail, /openExternalUrl\(item\?\.applyUrl\)/);
    assert.doesNotMatch(permissionDetail, /已打开真实审批入口/);
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
