import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { createApiServer } from '../src/server/app.ts';
import { createDatabase } from '../src/server/db.ts';
import { runMigrations } from '../src/server/migrations.ts';
import { seedDatabase } from '../src/server/seed.ts';

let baseUrl = '';
let closeServer: () => Promise<void>;
let tempDir = '';
const nativeFetch = globalThis.fetch.bind(globalThis);

async function requestJson<T>(
  route: string,
  init?: RequestInit,
): Promise<{ status: number; body: T }> {
  const response = await nativeFetch(`${baseUrl}${route}`, {
    headers: {
      'content-type': 'application/json',
      ...(route.startsWith('/api/admin/') ? { 'x-haina-role': 'admin', 'x-haina-actor': 'demo-admin' } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  return {
    status: response.status,
    body: (await response.json()) as T,
  };
}

describe('Phase 00 backend MVP APIs', () => {
  before(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'haina-api-'));
    const db = createDatabase(path.join(tempDir, 'test.db'));
    runMigrations(db);
    seedDatabase(db);
    const server = await createApiServer({ db, port: 0 });
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });

  after(async () => {
    await closeServer?.();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('serves seeded roles, permission package, and permission route data', async () => {
    const roles = await requestJson<{ data: Array<{ id: string; name: string }> }>('/api/roles');
    assert.equal(roles.status, 200);
    assert.equal(roles.body.data[0].name, '协同办公产品实习生');

    const pkg = await requestJson<{
      data: {
        role: { name: string };
        requiredPermissions: Array<{ name: string; permissionType: string }>;
        optionalPermissions: Array<{ name: string; permissionType: string }>;
      };
    }>(`/api/roles/${roles.body.data[0].id}/permission-package`);

    assert.equal(pkg.status, 200);
    assert.deepEqual(
      pkg.body.data.requiredPermissions.map((item) => item.name),
      ['OA 系统', 'Mail 海底捞邮箱'],
    );
    assert.deepEqual(
      pkg.body.data.optionalPermissions.map((item) => item.name),
      ['BPM 系统', 'ChatGPT 账号', 'QoderWork 账号'],
    );

    const route = await requestJson<{
      data: { applyUrl: string; reasonTemplate: string; approverName: string; commonWaitingReasons: string[] };
    }>(`/api/permission-items/${pkg.body.data.requiredPermissions[0].name === 'OA 系统' ? 'perm-oa' : 'missing'}/route`);
    assert.equal(route.status, 200);
    assert.match(route.body.data.applyUrl, /^mock-feishu:\/\/approval\//);
  });

  it('serves backend-configured D1 guide targets for simulated Feishu actions', async () => {
    const config = await requestJson<{
      data: {
        joinGroup: { targetGroupName: string; applyUrl: string; sendToEmployeeName: string; sendToEmployeeContact: string };
        employeeGuide: { documentTitle: string; documentUrl: string; ownerName: string };
        permissionPackage: { routePath: string; label: string };
      };
    }>('/api/d1-guide-config');

    assert.equal(config.status, 200);
    assert.equal(config.body.data.joinGroup.targetGroupName, '协同办公部门新人群');
    assert.match(config.body.data.joinGroup.applyUrl, /^mock-feishu:\/\/chat\//);
    assert.equal(config.body.data.joinGroup.sendToEmployeeName, '刘长省');
    assert.match(config.body.data.employeeGuide.documentUrl, /^mock-feishu:\/\/doc\//);
    assert.equal(config.body.data.permissionPackage.routePath, '/permissions');
    assert.equal(config.body.data.permissionPackage.label, '开通岗位权限包');
  });

  it('persists knowledge base metadata while keeping parsing and vectorization simulated', async () => {
    const created = await requestJson<{
      data: { id: string; title: string; parseStatus: string; vectorStatus: string };
    }>('/api/admin/knowledge-base-docs', {
      method: 'POST',
      body: JSON.stringify({
        title: '后台上传演示资料',
        category: '入职流程',
        applicableRoleId: 'role-product-intern',
        applicableRole: '协同办公产品实习生',
        applicableStage: 'D1-D7',
        sourceUrl: 'mock-drive://metadata-test',
        ownerName: '内容 Owner',
      }),
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.parseStatus, 'pending');
    assert.equal(created.body.data.vectorStatus, 'pending');

    const docs = await requestJson<{ data: Array<{ id: string; title: string }> }>('/api/admin/knowledge-base-docs');
    assert.equal(docs.status, 200);
    assert.ok(docs.body.data.some((doc) => doc.id === created.body.data.id && doc.title === '后台上传演示资料'));
  });

  it('persists permission progress and creates a 4-hour follow-up task', async () => {
    const created = await requestJson<{
      data: {
        progress: { id: string; status: string; submittedAt: string };
        followUpTask: { id: string; status: string; submittedAt: string; followUpAt: string };
      };
    }>('/api/newcomers/newcomer-yanyu/permission-progress', {
      method: 'POST',
      body: JSON.stringify({ permissionItemId: 'perm-mail', status: 'submitted' }),
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.progress.status, 'submitted');
    assert.equal(created.body.data.followUpTask.status, 'pending');

    const progress = await requestJson<{ data: Array<{ permissionItemId: string; status: string }> }>(
      '/api/newcomers/newcomer-yanyu/permission-progress',
    );
    assert.equal(progress.status, 200);
    assert.ok(progress.body.data.some((item) => item.permissionItemId === 'perm-mail' && item.status === 'submitted'));

    const followUp = await requestJson<{ data: { permissionProgressId: string; status: string } }>(
      `/api/follow-up-tasks/${created.body.data.followUpTask.id}`,
    );
    assert.equal(followUp.status, 200);
    assert.equal(followUp.body.data.permissionProgressId, created.body.data.progress.id);

    const followUps = await requestJson<{ data: Array<{ permissionItemId: string; status: string; permissionName: string }> }>(
      '/api/newcomers/newcomer-yanyu/follow-up-tasks',
    );
    assert.equal(followUps.status, 200);
    assert.ok(followUps.body.data.some((item) => item.permissionItemId === 'perm-mail' && item.status === 'pending'));
  });

  it('syncs one-click permission application selections and creates 4-hour follow-up tasks once', async () => {
    const synced = await requestJson<{
      data: { selectedPermissionItemIds: string[]; removedPermissionItemIds: string[] };
    }>('/api/newcomers/newcomer-cuilingfei/permission-applications', {
      method: 'PATCH',
      body: JSON.stringify({
        selectedPermissionItemIds: ['perm-bpm', 'perm-chatgpt'],
        scopePermissionItemIds: ['perm-bpm', 'perm-chatgpt'],
      }),
    });
    assert.equal(synced.status, 200);
    assert.deepEqual(synced.body.data.selectedPermissionItemIds, ['perm-bpm', 'perm-chatgpt']);

    const progress = await requestJson<{ data: Array<{ permissionItemId: string; status: string }> }>(
      '/api/newcomers/newcomer-cuilingfei/permission-progress',
    );
    assert.deepEqual(
      progress.body.data.map((item) => [item.permissionItemId, item.status]),
      [
        ['perm-bpm', 'submitted'],
        ['perm-chatgpt', 'submitted'],
      ],
    );

    const followUps = await requestJson<{ data: Array<{ permissionItemId: string; status: string }> }>('/api/newcomers/newcomer-cuilingfei/follow-up-tasks');
    assert.equal(followUps.status, 200);
    assert.deepEqual(
      followUps.body.data.map((item) => [item.permissionItemId, item.status]),
      [
        ['perm-bpm', 'pending'],
        ['perm-chatgpt', 'pending'],
      ],
    );

    const resynced = await requestJson<{
      data: { selectedPermissionItemIds: string[]; removedPermissionItemIds: string[] };
    }>('/api/newcomers/newcomer-cuilingfei/permission-applications', {
      method: 'PATCH',
      body: JSON.stringify({
        selectedPermissionItemIds: ['perm-chatgpt'],
        scopePermissionItemIds: ['perm-chatgpt'],
      }),
    });
    assert.equal(resynced.status, 200);
    assert.deepEqual(resynced.body.data.removedPermissionItemIds, []);

    const reloaded = await requestJson<{ data: Array<{ permissionItemId: string; status: string }> }>(
      '/api/newcomers/newcomer-cuilingfei/permission-progress',
    );
    assert.deepEqual(
      reloaded.body.data.map((item) => [item.permissionItemId, item.status]),
      [
        ['perm-bpm', 'submitted'],
        ['perm-chatgpt', 'submitted'],
      ],
    );

    const followUpsAfterRepeat = await requestJson<{ data: Array<{ permissionItemId: string }> }>(
      '/api/newcomers/newcomer-cuilingfei/follow-up-tasks',
    );
    assert.equal(followUpsAfterRepeat.body.data.length, 2);
  });

  it('dispatches simulated Feishu follow-up message cards only after the 4-hour follow-up time', async () => {
    const beforeDue = await requestJson<{ data: { sentCount: number } }>('/api/follow-up-message-cards/dispatch', {
      method: 'POST',
      body: JSON.stringify({ now: '2026-06-24T02:30:00.000Z' }),
    });
    assert.equal(beforeDue.status, 200);
    assert.equal(beforeDue.body.data.sentCount, 0);

    const due = await requestJson<{ data: { sentCount: number; cards: Array<{ permissionName: string; deliveryStatus: string; actionUrl: string }> } }>(
      '/api/follow-up-message-cards/dispatch',
      {
        method: 'POST',
        body: JSON.stringify({ now: '2099-01-01T00:00:00.000Z', newcomerId: 'newcomer-cuilingfei' }),
      },
    );
    assert.equal(due.status, 200);
    assert.equal(due.body.data.sentCount, 2);
    assert.deepEqual(
      due.body.data.cards.map((card) => [card.permissionName, card.deliveryStatus]),
      [
        ['BPM 系统', 'simulated_sent'],
        ['ChatGPT 账号', 'simulated_sent'],
      ],
    );
    assert.ok(due.body.data.cards.every((card) => card.actionUrl.startsWith('/follow-up/')));

    const repeat = await requestJson<{ data: { sentCount: number } }>('/api/follow-up-message-cards/dispatch', {
      method: 'POST',
      body: JSON.stringify({ now: '2099-01-01T00:00:00.000Z', newcomerId: 'newcomer-cuilingfei' }),
    });
    assert.equal(repeat.status, 200);
    assert.equal(repeat.body.data.sentCount, 0);

    const cards = await requestJson<{ data: Array<{ permissionName: string; cardTitle: string; deliveryChannel: string }> }>(
      '/api/newcomers/newcomer-cuilingfei/follow-up-message-cards',
    );
    assert.equal(cards.status, 200);
    assert.deepEqual(
      cards.body.data.map((card) => [card.permissionName, card.deliveryChannel]),
      [
        ['BPM 系统', 'feishu_message_card_simulated'],
        ['ChatGPT 账号', 'feishu_message_card_simulated'],
      ],
    );
    assert.ok(cards.body.data.every((card) => card.cardTitle.includes('权限开通回访')));
  });

  it('validates and persists anonymous and weekly feedback submissions', async () => {
    const invalid = await requestJson<{ error: string }>('/api/anonymous-feedbacks', {
      method: 'POST',
      body: JSON.stringify({ type: '流程建议', module: '权限包', expectedAction: '补充说明' }),
    });
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /description/);

    const anonymous = await requestJson<{ data: { id: string; feedbackNo: string; isAnonymous: boolean } }>(
      '/api/anonymous-feedbacks',
      {
        method: 'POST',
        body: JSON.stringify({
          type: '流程建议',
          module: '权限申请',
          description: '申请入口说明可以更清晰',
          expectedAction: '补充常见等待原因',
          isAnonymous: true,
          submittedByNewcomerId: 'newcomer-yanyu',
        }),
      },
    );
    assert.equal(anonymous.status, 201);
    assert.equal(anonymous.body.data.isAnonymous, true);

    const pool = await requestJson<{ data: Array<{ id: string; description: string }> }>('/api/admin/anonymous-feedbacks');
    assert.ok(pool.body.data.some((item) => item.id === anonymous.body.data.id));

    const weekly = await requestJson<{ data: { id: string; newcomerId: string; visibleToManager: boolean } }>(
      '/api/weekly-feedbacks',
      {
        method: 'POST',
        body: JSON.stringify({
          newcomerId: 'newcomer-yanyu',
          overallFeeling: '节奏清晰',
          blockers: '暂无',
          supportNeeded: '希望继续跟进权限到账',
          message: '感谢 mentor 支持',
        }),
      },
    );
    assert.equal(weekly.status, 201);
    assert.equal(weekly.body.data.visibleToManager, true);

    const reloaded = await requestJson<{ data: { id: string; message: string } }>(
      '/api/newcomers/newcomer-yanyu/weekly-feedback',
    );
    assert.equal(reloaded.body.data.id, weekly.body.data.id);
  });

  it('serves dynamic anonymous feedback config and persists structured classification', async () => {
    const config = await requestJson<{
      data: {
        modules: Array<{
          moduleKey: string;
          label: string;
          problemTypes: Array<{ typeKey: string; label: string; requiresText: boolean }>;
          expectedActions: Array<{ actionKey: string; label: string }>;
        }>;
      };
    }>('/api/anonymous-feedback-config');
    assert.equal(config.status, 200);
    assert.deepEqual(
      config.body.data.modules.map((module) => module.moduleKey),
      ['knowledge', 'd1_guide', 'permission', 'follow_up'],
    );
    const permission = config.body.data.modules.find((module) => module.moduleKey === 'permission')!;
    assert.deepEqual(
      permission.problemTypes.map((item) => item.label),
      ['不知道从哪里申请', '不知道怎么填写', '审批人/Owner不清楚', '提交后没人处理', '其他'],
    );
    assert.ok(permission.problemTypes.find((item) => item.typeKey === 'other')?.requiresText);

    const created = await requestJson<{
      data: {
        id: string;
        module: string;
        type: string;
        expectedAction: string;
        detail: { moduleKey: string; problemTypeKey: string; expectedActionKeys: string[] };
      };
    }>('/api/anonymous-feedbacks', {
      method: 'POST',
      body: JSON.stringify({
        moduleKey: 'permission',
        problemTypeKey: 'entry_missing',
        expectedActionKeys: ['add_entry', 'transfer_permission_owner'],
        description: '找不到 ChatGPT 账号申请入口',
        isAnonymous: true,
        submittedByNewcomerId: 'newcomer-yanyu',
      }),
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.module, '权限申请');
    assert.equal(created.body.data.type, '不知道从哪里申请');
    assert.equal(created.body.data.expectedAction, '补充申请入口、转权限Owner核对');
    assert.deepEqual(created.body.data.detail.expectedActionKeys, ['add_entry', 'transfer_permission_owner']);

    const pool = await requestJson<{ data: Array<{ id: string; detail?: { moduleKey: string; problemTypeKey: string } }> }>(
      '/api/admin/anonymous-feedbacks',
    );
    const reloaded = pool.body.data.find((item) => item.id === created.body.data.id);
    assert.deepEqual(reloaded?.detail, { moduleKey: 'permission', problemTypeKey: 'entry_missing', expectedActionKeys: ['add_entry', 'transfer_permission_owner'] });
  });

  it('serves configurable weekly feedback questions, stores structured answers, and analyzes option counts', async () => {
    const config = await requestJson<{
      data: {
        questions: Array<{ id: string; questionKey: string; title: string; inputType: string; options: Array<{ id: string; label: string }> }>;
      };
    }>('/api/weekly-feedback-config');
    assert.equal(config.status, 200);
    assert.deepEqual(
      config.body.data.questions.map((question) => [question.questionKey, question.inputType]),
      [
        ['overall_feeling', 'single'],
        ['blockers', 'multi'],
        ['support_needed', 'multi'],
        ['message', 'text'],
      ],
    );

    const overall = config.body.data.questions.find((question) => question.questionKey === 'overall_feeling')!;
    const blockers = config.body.data.questions.find((question) => question.questionKey === 'blockers')!;
    const support = config.body.data.questions.find((question) => question.questionKey === 'support_needed')!;
    const message = config.body.data.questions.find((question) => question.questionKey === 'message')!;

    const submitted = await requestJson<{ data: { id: string; overallFeeling: string; blockers: string; supportNeeded: string; message: string } }>(
      '/api/weekly-feedbacks',
      {
        method: 'POST',
        body: JSON.stringify({
          newcomerId: 'newcomer-cuilingfei',
          answers: [
            { questionId: overall.id, selectedOptionIds: [overall.options[1].id] },
            { questionId: blockers.id, selectedOptionIds: [blockers.options[0].id, blockers.options[2].id] },
            { questionId: support.id, selectedOptionIds: [support.options[0].id] },
            { questionId: message.id, textValue: '希望下周安排一个轻量真实任务。' },
          ],
        }),
      },
    );
    assert.equal(submitted.status, 201);
    assert.equal(submitted.body.data.overallFeeling, overall.options[1].label);
    assert.equal(submitted.body.data.blockers, `${blockers.options[0].label}、${blockers.options[2].label}`);
    assert.equal(submitted.body.data.supportNeeded, support.options[0].label);
    assert.equal(submitted.body.data.message, '希望下周安排一个轻量真实任务。');

    const analysis = await requestJson<{
      data: {
        submissionCount: number;
        questions: Array<{ questionKey: string; options: Array<{ label: string; count: number }> }>;
      };
    }>('/api/admin/weekly-feedback-analysis');
    assert.equal(analysis.status, 200);
    assert.ok(analysis.body.data.submissionCount >= 2);
    const analyzedBlockers = analysis.body.data.questions.find((question) => question.questionKey === 'blockers')!;
    assert.ok(analyzedBlockers.options.some((option) => option.label === blockers.options[0].label && option.count >= 1));

    const patched = await requestJson<{ data: { questions: Array<{ id: string; title: string; options: Array<{ id: string; label: string }> }> } }>(
      '/api/admin/weekly-feedback-config',
      {
        method: 'PATCH',
        body: JSON.stringify({
          questions: [
            {
              id: overall.id,
              title: '首周整体感受（后台配置）',
              options: [{ id: overall.options[1].id, label: '整体顺利（后台配置）' }],
            },
          ],
        }),
      },
    );
    assert.equal(patched.status, 200);
    const patchedOverall = patched.body.data.questions.find((question) => question.id === overall.id)!;
    assert.equal(patchedOverall.title, '首周整体感受（后台配置）');
    assert.ok(patchedOverall.options.some((option) => option.label === '整体顺利（后台配置）'));
  });

  it('updates manager action state and reloads admin/review data from the database', async () => {
    const action = await requestJson<{ data: { managerViewed: boolean; managerActionStatus: string; actionNote: string } }>(
      '/api/manager/feedback/weekly-yanyu/action',
      {
        method: 'PATCH',
        body: JSON.stringify({ managerActionStatus: 'followed_up', actionNote: '已安排 mentor 明天确认权限' }),
      },
    );
    assert.equal(action.status, 200);
    assert.equal(action.body.data.managerViewed, true);
    assert.equal(action.body.data.managerActionStatus, 'followed_up');

    const admin = await requestJson<{ data: { roles: unknown[]; permissionItems: unknown[]; anonymousFeedbacks: unknown[] } }>(
      '/api/admin/config',
    );
    assert.equal(admin.status, 200);
    assert.ok(admin.body.data.roles.length > 0);
    assert.ok(admin.body.data.permissionItems.length > 0);
    assert.ok(admin.body.data.anonymousFeedbacks.length > 0);

    const metrics = await requestJson<{ data: { newcomerCount: number; anonymousFeedbackCount: number } }>(
      '/api/review/metrics',
    );
    assert.equal(metrics.status, 200);
    assert.ok(metrics.body.data.newcomerCount >= 2);
    assert.ok(metrics.body.data.anonymousFeedbackCount >= 1);
  });
});
