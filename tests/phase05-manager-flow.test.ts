import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { getBottomNavItems } from '../src/frontend/routes.ts';
import { createApiServer } from '../src/server/app.ts';
import { createDatabase } from '../src/server/db.ts';
import { runMigrations } from '../src/server/migrations.ts';
import { seedDatabase } from '../src/server/seed.ts';

function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = source.indexOf('\nexport function ', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe('Phase 05 manager flow', () => {
  let baseUrl = '';
  let closeServer: () => Promise<void>;
  let tempDir = '';
  let db: ReturnType<typeof createDatabase>;
  const nativeFetch = globalThis.fetch.bind(globalThis);

  async function requestJson<T>(route: string, init?: RequestInit): Promise<{ status: number; body: T }> {
    const response = await nativeFetch(`${baseUrl}${route}`, {
      headers: {
        'content-type': 'application/json',
        'x-haina-role': 'manager',
        'x-haina-actor': 'demo-manager',
        ...(init?.headers ?? {}),
      },
      ...init,
    });
    return {
      status: response.status,
      body: (await response.json()) as T,
    };
  }

  async function requestAdminJson<T>(route: string, init?: RequestInit): Promise<{ status: number; body: T }> {
    const response = await nativeFetch(`${baseUrl}${route}`, {
      headers: {
        'content-type': 'application/json',
        'x-haina-role': 'admin',
        'x-haina-actor': 'demo-admin',
        ...(init?.headers ?? {}),
      },
      ...init,
    });
    return {
      status: response.status,
      body: (await response.json()) as T,
    };
  }

  function daysAgoIso(days: number): string {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  before(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'haina-phase05-'));
    db = createDatabase(path.join(tempDir, 'test.db'));
    runMigrations(db);
    seedDatabase(db);
    db.prepare("UPDATE newcomers SET stage = 'D8' WHERE id = 'newcomer-cuilingfei'").run();
    db.prepare(
      `INSERT INTO permission_progress
       (id, newcomerId, permissionItemId, status, submittedAt, completedAt, lastActionAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'progress-cuilingfei-chatgpt',
      'newcomer-cuilingfei',
      'perm-chatgpt',
      'submitted',
      '2026-06-24T02:00:00.000Z',
      null,
      '2026-06-24T02:00:00.000Z',
      '2026-06-24T02:00:00.000Z',
      '2026-06-24T02:00:00.000Z',
    );
    db.prepare(
      `INSERT INTO follow_up_tasks
       (id, newcomerId, permissionProgressId, submittedAt, followUpAt, status, ownerName, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'follow-up-cuilingfei-chatgpt',
      'newcomer-cuilingfei',
      'progress-cuilingfei-chatgpt',
      '2026-06-24T02:00:00.000Z',
      '2026-06-24T06:00:00.000Z',
      'pending',
      '刘长省',
      '2026-06-24T02:00:00.000Z',
      '2026-06-24T02:00:00.000Z',
    );
    db.prepare(
      `INSERT INTO roles
       (id, name, department, description, createdAt, updatedAt, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'role-ai-builder',
      'AI builder',
      '协同办公部门',
      '后台新增岗位，用于验证管理者首页岗位统计同步。',
      '2026-06-24T02:00:00.000Z',
      '2026-06-24T02:00:00.000Z',
      'demo-admin',
    );
    db.prepare(
      `INSERT OR IGNORE INTO weekly_feedback_questions
       (id, questionKey, title, description, inputType, required, maxLength, enabled, sortOrder, createdAt, updatedAt, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'wfq-work-summary',
      'work_summary',
      '首周工作摘要',
      '同步新人端填写的首周工作摘要。',
      'text',
      0,
      500,
      1,
      5,
      '2026-06-24T02:00:00.000Z',
      '2026-06-24T02:00:00.000Z',
      'demo-admin',
    );
    db.prepare(
      `INSERT INTO weekly_feedback_answers
       (id, weeklyFeedbackId, questionId, optionId, textValue, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'wfa-yanyu-work-summary',
      'weekly-yanyu',
      'wfq-work-summary',
      null,
      '111',
      '2026-06-24T05:00:00.000Z',
      '2026-06-24T05:00:00.000Z',
    );
    const server = await createApiServer({ db, port: 0 });
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });

  after(async () => {
    await closeServer?.();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('keeps manager bottom nav labels and page highlights aligned with Phase 05', () => {
    assert.deepEqual(
      getBottomNavItems('10').map((item) => [item.label, item.pages]),
      [
        ['总览', ['10']],
        ['新人', ['11']],
      ],
    );
  });

  it('serves manager overview through one backend aggregate scoped by manager context with pagination', async () => {
    const overview = await requestJson<{
      data: {
        scope: { managerName: string };
        summary: { visibleNewcomerCount: number; submittedWeeklyCount: number; pendingManagerActionCount: number };
        roleStats: Array<{ roleId: string; roleName: string; count: number }>;
        recentWeeklyFeedbackId: string;
        newcomers: Array<{
          id: string;
          name: string;
          stage: string;
          includeReason: string;
          onboardingStatus: 'weekly_feedback_pending_review' | 'permission_pending_follow_up' | 'on_track';
          primaryAction: { label: string; type: string; targetPath?: string };
          pendingFollowUpCount: number;
        }>;
        page: { limit: number; offset: number; hasMore: boolean };
      };
    }>('/api/manager/overview?managerName=Other&departmentId=dept-other&limit=20&offset=0');

    assert.equal(overview.status, 200);
    assert.equal(overview.body.data.scope.managerName, '刘长省');
    assert.equal(overview.body.data.page.limit, 20);
    assert.equal(overview.body.data.page.offset, 0);
    assert.equal(overview.body.data.page.hasMore, false);
    assert.ok(overview.body.data.roleStats.some((item) => item.roleName === 'AI builder' && item.count === 0));
    assert.ok(overview.body.data.recentWeeklyFeedbackId);
    assert.ok(overview.body.data.newcomers.every((item) => item.includeReason === 'first_week' || item.includeReason === 'pending_todo'));
  });

  it('filters the weekly arrival list by Feishu org join stage and caps it at D7', async () => {
    const overview = await requestJson<{ data: { newcomers: Array<{ id: string; stage: string; includeReason: string; pendingFollowUpCount: number }> } }>(
      '/api/manager/overview?limit=10&offset=0',
    );

    const yanyu = overview.body.data.newcomers.find((item) => item.id === 'newcomer-yanyu');
    const cuilingfei = overview.body.data.newcomers.find((item) => item.id === 'newcomer-cuilingfei');
    assert.equal(yanyu?.stage, 'D7');
    assert.equal(yanyu?.includeReason, 'first_week');
    assert.equal(cuilingfei?.stage, 'D1');
    assert.equal(cuilingfei?.includeReason, 'first_week');

    db.prepare("UPDATE newcomer_task_states SET completedAt = ? WHERE newcomerId = ? AND taskKey = 'join_feishu_org'").run(
      daysAgoIso(7),
      'newcomer-yanyu',
    );
    const d8Overview = await requestJson<{ data: { newcomers: Array<{ id: string; stage: string }> } }>('/api/manager/overview?limit=10&offset=0');
    assert.equal(d8Overview.body.data.newcomers.some((item) => item.id === 'newcomer-yanyu'), false);
    db.prepare("UPDATE newcomer_task_states SET completedAt = ? WHERE newcomerId = ? AND taskKey = 'join_feishu_org'").run(
      daysAgoIso(6),
      'newcomer-yanyu',
    );
  });

  it('syncs manager role statistics with enabled admin positions only', async () => {
    for (const roleId of ['role-product-intern', 'role-ai-builder']) {
      const disabled = await requestAdminJson<{ data: { id: string; enabled: boolean } }>(`/api/admin/roles/${roleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: false }),
      });
      assert.equal(disabled.status, 200);
      assert.equal(disabled.body.data.enabled, false);
    }

    const overview = await requestJson<{
      data: {
        summary: { visibleNewcomerCount: number };
        roleStats: Array<{ roleId: string; roleName: string; count: number }>;
      };
    }>('/api/manager/overview?limit=20&offset=0');

    assert.equal(overview.status, 200);
    assert.ok(overview.body.data.summary.visibleNewcomerCount >= 2);
    assert.equal(overview.body.data.roleStats.some((item) => item.roleId === 'role-product-intern'), false);
    assert.equal(overview.body.data.roleStats.some((item) => item.roleId === 'role-ai-builder'), false);
  });

  it('serves manager newcomer detail as a scoped weekly-feedback snapshot', async () => {
    const detail = await requestJson<{
      data: {
        scope: { managerName: string };
        newcomer: { id: string; managerName: string; stage: string };
        weeklyFeedback: {
          statusText: string;
          workSummary: string;
          overallFeeling: string;
          blockers: string[];
          supportNeeded: string[];
          message: string;
        } | null;
      };
    }>('/api/manager/newcomer/newcomer-yanyu?managerName=Other');

    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.scope.managerName, '刘长省');
    assert.equal(detail.body.data.newcomer.id, 'newcomer-yanyu');
    assert.equal(detail.body.data.newcomer.stage, 'D7');
    assert.equal(detail.body.data.weeklyFeedback?.workSummary, '111');
    assert.equal(detail.body.data.weeklyFeedback?.overallFeeling, '整体清晰，权限等待有一点不确定');
    assert.deepEqual(detail.body.data.weeklyFeedback?.blockers, ['OA 已提交，邮箱还在等待开通']);
    assert.deepEqual(detail.body.data.weeklyFeedback?.supportNeeded, ['希望 mentor 帮忙确认邮箱进度']);
    assert.ok(detail.body.data.weeklyFeedback?.message);

    assert.equal('timelineNodes' in detail.body.data, false);
    assert.equal('completionItems' in detail.body.data, false);
    assert.equal('blockers' in detail.body.data, false);
    assert.equal('managerSuggestions' in detail.body.data, false);
    assert.equal('weeklySummary' in detail.body.data, false);
    assert.equal('secondaryActions' in detail.body.data, false);
  });

  it('rejects manager detail and feedback access outside the current manager scope', async () => {
    const detail = await requestJson<{ error: string }>('/api/manager/newcomer/newcomer-yanyu', {
      headers: { 'x-haina-actor': 'demo-other-manager' },
    });
    const feedback = await requestJson<{ error: string }>('/api/manager/feedback/weekly-yanyu', {
      headers: { 'x-haina-actor': 'demo-other-manager' },
    });

    assert.equal(detail.status, 404);
    assert.equal(feedback.status, 404);
  });

  it('renders page 10 manager overview content and routes feedback nav through weekly-feedback availability', () => {
    const managerPages = readFileSync('src/frontend/pages/managerPages.tsx', 'utf8');
    const app = readFileSync('src/frontend/App.tsx', 'utf8');
    const appState = readFileSync('src/frontend/appState.ts', 'utf8');
    const page10 = extractFunction(managerPages, 'ManagerPage');

    for (const copy of ['今日新员工', '协同办公部门今日入职概览', '岗位统计', '周内到岗名单']) {
      assert.match(page10, new RegExp(copy));
    }
    assert.match(page10, /roleStats/);
    assert.match(page10, /item\.roleName/);
    assert.equal(page10.includes('roleStatLabel'), false);
    assert.match(page10, /manager-overview-hero-number/);
    assert.equal(page10.includes('首周中'), false);
    assert.equal(page10.includes('今日需关注'), false);
    assert.equal(page10.includes('今日到岗名单'), false);
    assert.equal(page10.includes('点击查看详情'), false);
    assert.equal(page10.includes('查看首周详情'), false);
    assert.equal(page10.includes('权限待跟进'), false);
    assert.equal(page10.includes('进展正常'), false);
    assert.match(page10, /manager-newcomer-link-icon/);
    assert.match(app, /function handleBottomNavNavigate/);
    assert.match(app, /暂无新人首周反馈/);
    assert.match(app, /\/manager\/feedback\/\$\{data\.managerOverview\.recentWeeklyFeedbackId\}/);
    assert.match(appState, /api\.getManagerOverview/);
    assert.equal(appState.includes('DEMO_SECONDARY_NEWCOMER_ID'), false);
    assert.equal(page10.includes('今日管理动作'), false);
  });

  it('renders page 11 as a newcomer weekly-feedback snapshot without manager-only follow-up sections', () => {
    const managerPages = readFileSync('src/frontend/pages/managerPages.tsx', 'utf8');
    const page11 = extractFunction(managerPages, 'ManagerDetailPage');

    for (const copy of [
      '首周工作摘要',
      '首周整体感受',
      '目前主要卡点（可多选）',
      '希望管理者提供的支持（可多选）',
      '新人想说的话',
      'weeklyFeedback.workSummary',
    ]) {
      assert.match(page11, new RegExp(copy));
    }
    for (const removedCopy of ['新人首周工作摘要', '本周完成情况', '当前阻塞', '管理者建议', '新人首周反馈', '查看完整反馈']) {
      assert.equal(page11.includes(removedCopy), false);
    }
    assert.equal(page11.includes('StatGrid'), false);
    assert.equal(page11.includes('StepList'), false);
    assert.equal(page11.includes('completionItems'), false);
    assert.equal(page11.includes('managerSuggestions'), false);
    assert.match(page11, /readonlyFeedbackTags\(\[weeklyFeedback\.overallFeeling \|\| weeklyFeedback\.statusText\]/);
    assert.equal(page11.includes('<StatusChip tone={weeklyFeedback.statusStyle}>'), false);
    assert.match(page11, /data\.managerDetail/);
    assert.equal(page11.includes('api.getPermissionProgress'), false);
    assert.equal(page11.includes('匿名反馈原文'), false);
    assert.equal(page11.includes('能力评分'), false);
    assert.equal(page11.includes('排名'), false);
  });

  it('renders page 12 as read-only full weekly feedback with persisted manager actions and empty state', () => {
    const managerPages = readFileSync('src/frontend/pages/managerPages.tsx', 'utf8');
    const page12 = extractFunction(managerPages, 'ManagerFeedbackPage');

    for (const copy of [
      '新人首周反馈',
      '由入职者填写，供管理者查看与跟进',
      '首周整体感受',
      '目前主要卡点',
      '希望管理者提供的支持',
      '新人想说的话',
      '新人暂未提交首周反馈',
      '可在 D7 前提醒新人填写。',
      '提醒新人填写',
      '返回详情',
      '已模拟提醒新人填写首周反馈',
      '不用于绩效评价',
    ]) {
      assert.match(page12, new RegExp(copy));
    }
    assert.match(page12, /record\('pending_follow_up'/);
    assert.match(page12, /record\('viewed'/);
    assert.equal(page12.includes('<input'), false);
    assert.equal(page12.includes('<textarea'), false);
    assert.equal(page12.includes('匿名反馈原文'), false);
    assert.equal(page12.includes('能力评分'), false);
    assert.equal(page12.includes('排名'), false);
  });

  it('loads manager detail and feedback data from route params without exposing anonymous feedbacks', () => {
    const appState = readFileSync('src/frontend/appState.ts', 'utf8');
    const managerLoader = appState.slice(appState.indexOf('async function loadManagerSurfaceData'));

    assert.match(managerLoader, /params/);
    assert.match(managerLoader, /api\.getManagerNewcomerDetail\(newcomerId\)/);
    assert.match(appState, /api\.getManagerFeedback\(feedbackId\)/);
    assert.equal(managerLoader.includes('getOptionalWeeklyFeedback(newcomerId)'), false);
    assert.equal(managerLoader.includes('getAnonymousFeedbacks'), false);
    assert.equal(managerLoader.includes('api.getRoles()'), false);
  });
});
