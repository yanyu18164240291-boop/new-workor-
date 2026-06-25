import http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { SQLInputValue } from 'node:sqlite';

import { boolFromDb, boolToDb, nowIso, type Database } from './db.ts';

type ApiContext = {
  db: Database;
  method: string;
  pathname: string;
  request: http.IncomingMessage;
  response: http.ServerResponse;
};

type ApiResult = {
  status?: number;
  data?: unknown;
  error?: string;
};

type RouteMatch = {
  pattern: RegExp;
  handler: (context: ApiContext, match: RegExpMatchArray) => Promise<ApiResult> | ApiResult;
};

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function normalizeRow<T extends Record<string, unknown>>(row: T | undefined): Record<string, unknown> | undefined {
  if (!row) return undefined;
  const next: Record<string, unknown> = { ...row };
  for (const key of ['sensitive', 'enabled', 'required', 'requiresText', 'd1GuideCompleted', 'permissionPackageViewed', 'weeklyFeedbackSubmitted', 'managerViewedFeedback', 'isAnonymous', 'includedInReview', 'visibleToManager', 'managerViewed']) {
    if (key in next) next[key] = boolFromDb(next[key]);
  }
  if ('commonWaitingReasons' in next) next.commonWaitingReasons = parseJsonArray(next.commonWaitingReasons);
  if ('expectedActionKeys' in next) next.expectedActionKeys = parseJsonArray(next.expectedActionKeys);
  return next;
}

function normalizeRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => normalizeRow(row)!);
}

async function readBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function stringArray(body: Record<string, unknown>, key: string): string[] {
  const value = body[key];
  if (!Array.isArray(value)) throw new Error(`${key} is required`);
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim());
}

function sqlValue(value: unknown): SQLInputValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'boolean') return boolToDb(value);
  return String(value);
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function validIsoNow(value: unknown): string {
  if (typeof value !== 'string') return nowIso();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('now is invalid');
  return date.toISOString();
}

function getPermission(db: Database, id: string): Record<string, unknown> | undefined {
  return normalizeRow(db.prepare('SELECT * FROM permission_items WHERE id = ?').get(id) as Record<string, unknown> | undefined);
}

function getWeeklyWithAction(db: Database, weeklyFeedbackId: string): Record<string, unknown> | undefined {
  const feedback = normalizeRow(
    db.prepare('SELECT * FROM weekly_feedbacks WHERE id = ?').get(weeklyFeedbackId) as Record<string, unknown> | undefined,
  );
  if (!feedback) return undefined;
  const action = normalizeRow(
    db.prepare('SELECT * FROM manager_feedback_actions WHERE weeklyFeedbackId = ?').get(weeklyFeedbackId) as
      | Record<string, unknown>
      | undefined,
  );
  return { ...feedback, managerAction: action ?? null };
}

function getD1GuideConfig(db: Database): Record<string, unknown> {
  const rows = normalizeRows(
    db.prepare('SELECT * FROM d1_guide_configs WHERE enabled = 1 ORDER BY sortOrder').all() as Array<Record<string, unknown>>,
  );
  const byKey = Object.fromEntries(rows.map((row) => [String(row.actionKey), row]));
  return {
    joinGroup: byKey.join_group ?? null,
    employeeGuide: byKey.employee_guide ?? null,
    permissionPackage: byKey.permission_package ?? null,
  };
}

function getWeeklyFeedbackConfig(db: Database): Record<string, unknown> {
  const questions = normalizeRows(
    db.prepare('SELECT * FROM weekly_feedback_questions WHERE enabled = 1 ORDER BY sortOrder').all() as Array<Record<string, unknown>>,
  );
  const options = normalizeRows(
    db.prepare('SELECT * FROM weekly_feedback_options WHERE enabled = 1 ORDER BY sortOrder').all() as Array<Record<string, unknown>>,
  );
  return {
    questions: questions.map((question) => ({
      ...question,
      options: options.filter((option) => option.questionId === question.id),
    })),
  };
}

function getAnonymousFeedbackConfig(db: Database): Record<string, unknown> {
  const modules = normalizeRows(
    db.prepare('SELECT * FROM anonymous_feedback_modules WHERE enabled = 1 ORDER BY sortOrder').all() as Array<Record<string, unknown>>,
  );
  const problemTypes = normalizeRows(
    db.prepare('SELECT * FROM anonymous_feedback_problem_types WHERE enabled = 1 ORDER BY sortOrder').all() as Array<Record<string, unknown>>,
  );
  const expectedActions = normalizeRows(
    db.prepare('SELECT * FROM anonymous_feedback_expected_actions WHERE enabled = 1 ORDER BY sortOrder').all() as Array<Record<string, unknown>>,
  );
  return {
    modules: modules.map((module) => ({
      ...module,
      problemTypes: problemTypes.filter((item) => item.moduleId === module.id),
      expectedActions: expectedActions.filter((item) => item.moduleId === module.id),
    })),
  };
}

function getAnonymousFeedbackDetail(db: Database, anonymousFeedbackId: string): Record<string, unknown> | null {
  const detail =
    normalizeRow(
      db.prepare('SELECT * FROM anonymous_feedback_details WHERE anonymousFeedbackId = ?').get(anonymousFeedbackId) as
        | Record<string, unknown>
        | undefined,
    ) ?? null;
  if (!detail) return null;
  const publicDetail: Record<string, unknown> = {
    moduleKey: detail.moduleKey,
    problemTypeKey: detail.problemTypeKey,
    expectedActionKeys: detail.expectedActionKeys,
  };
  if (detail.problemTypeOtherText) publicDetail.problemTypeOtherText = detail.problemTypeOtherText;
  if (detail.expectedActionOtherText) publicDetail.expectedActionOtherText = detail.expectedActionOtherText;
  return publicDetail;
}

function withAnonymousFeedbackDetail(db: Database, row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, detail: getAnonymousFeedbackDetail(db, String(row.id)) };
}

function resolveStructuredAnonymousFeedback(
  db: Database,
  body: Record<string, unknown>,
): {
  moduleLabel: string;
  typeLabel: string;
  expectedActionLabel: string;
  detail: {
    moduleKey: string;
    problemTypeKey: string;
    problemTypeOtherText: string | null;
    expectedActionKeys: string[];
    expectedActionOtherText: string | null;
  };
} | null {
  if (!('moduleKey' in body || 'problemTypeKey' in body || 'expectedActionKeys' in body)) return null;
  const moduleKey = requiredString(body, 'moduleKey');
  const problemTypeKey = requiredString(body, 'problemTypeKey');
  const expectedActionKeys = stringArray(body, 'expectedActionKeys');
  const module = normalizeRow(
    db.prepare('SELECT * FROM anonymous_feedback_modules WHERE moduleKey = ? AND enabled = 1').get(moduleKey) as
      | Record<string, unknown>
      | undefined,
  );
  if (!module) throw new Error('moduleKey is invalid');
  const problemType = normalizeRow(
    db
      .prepare('SELECT * FROM anonymous_feedback_problem_types WHERE moduleId = ? AND typeKey = ? AND enabled = 1')
      .get(sqlValue(module.id), problemTypeKey) as Record<string, unknown> | undefined,
  );
  if (!problemType) throw new Error('problemTypeKey is invalid');
  const problemTypeOtherText = typeof body.problemTypeOtherText === 'string' ? body.problemTypeOtherText.trim() : '';
  if (problemType.requiresText && problemTypeOtherText.length === 0) throw new Error('problemTypeOtherText is required');
  const actionRows = expectedActionKeys.map((actionKey) =>
    normalizeRow(
      db
        .prepare('SELECT * FROM anonymous_feedback_expected_actions WHERE moduleId = ? AND actionKey = ? AND enabled = 1')
        .get(sqlValue(module.id), actionKey) as Record<string, unknown> | undefined,
    ),
  );
  if (actionRows.some((row) => !row)) throw new Error('expectedActionKeys is invalid');
  const expectedActionOtherText = typeof body.expectedActionOtherText === 'string' ? body.expectedActionOtherText.trim() : '';
  for (const action of actionRows) {
    if (action?.requiresText && expectedActionOtherText.length === 0) throw new Error('expectedActionOtherText is required');
  }
  return {
    moduleLabel: String(module.label),
    typeLabel: problemTypeOtherText ? `${problemType.label}：${problemTypeOtherText}` : String(problemType.label),
    expectedActionLabel: actionRows
      .map((action) => (expectedActionOtherText && action?.requiresText ? `${action.label}：${expectedActionOtherText}` : String(action?.label)))
      .join('、'),
    detail: {
      moduleKey,
      problemTypeKey,
      problemTypeOtherText: problemTypeOtherText || null,
      expectedActionKeys,
      expectedActionOtherText: expectedActionOtherText || null,
    },
  };
}

function optionLabels(db: Database, optionIds: string[]): string[] {
  if (optionIds.length === 0) return [];
  return optionIds
    .map((id) => db.prepare('SELECT label FROM weekly_feedback_options WHERE id = ?').get(id) as { label: string } | undefined)
    .filter((item): item is { label: string } => Boolean(item))
    .map((item) => item.label);
}

function answerSelection(answer: Record<string, unknown>): string[] {
  return Array.isArray(answer.selectedOptionIds)
    ? answer.selectedOptionIds.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim())
    : [];
}

function deriveWeeklyLegacyFields(
  db: Database,
  answers: Array<Record<string, unknown>>,
): { overallFeeling: string; blockers: string; supportNeeded: string; message: string } {
  const questions = db.prepare('SELECT id, questionKey FROM weekly_feedback_questions').all() as Array<{ id: string; questionKey: string }>;
  const byId = new Map(questions.map((question) => [question.id, question.questionKey]));
  const byKey = new Map<string, Record<string, unknown>>();
  for (const answer of answers) {
    const questionId = typeof answer.questionId === 'string' ? answer.questionId : '';
    const key = byId.get(questionId);
    if (key) byKey.set(key, answer);
  }
  const overallIds = answerSelection(byKey.get('overall_feeling') ?? {});
  const blockerIds = answerSelection(byKey.get('blockers') ?? {});
  const supportIds = answerSelection(byKey.get('support_needed') ?? {});
  const messageAnswer = byKey.get('message');
  return {
    overallFeeling: optionLabels(db, overallIds)[0] ?? '',
    blockers: optionLabels(db, blockerIds).join('、'),
    supportNeeded: optionLabels(db, supportIds).join('、'),
    message: typeof messageAnswer?.textValue === 'string' ? messageAnswer.textValue.trim() : '',
  };
}

function validateWeeklyAnswers(db: Database, answers: Array<Record<string, unknown>>): void {
  const questions = db.prepare('SELECT * FROM weekly_feedback_questions WHERE enabled = 1 ORDER BY sortOrder').all() as Array<Record<string, unknown>>;
  const options = db.prepare('SELECT id, questionId FROM weekly_feedback_options WHERE enabled = 1').all() as Array<{ id: string; questionId: string }>;
  const optionQuestionById = new Map(options.map((option) => [option.id, option.questionId]));
  const byQuestionId = new Map(answers.map((answer) => [String(answer.questionId), answer]));
  for (const question of questions) {
    const answer = byQuestionId.get(String(question.id));
    if (question.required && !answer) throw new Error(`${question.title} is required`);
    if (!answer) continue;
    if (question.inputType === 'single' && answerSelection(answer).length !== 1) throw new Error(`${question.title} must select one option`);
    if (question.inputType === 'multi' && question.required && answerSelection(answer).length === 0) throw new Error(`${question.title} must select at least one option`);
    for (const optionId of answerSelection(answer)) {
      if (optionQuestionById.get(optionId) !== question.id) throw new Error(`${question.title} has invalid option`);
    }
    if (question.inputType === 'text' && question.required && (typeof answer.textValue !== 'string' || answer.textValue.trim().length === 0)) {
      throw new Error(`${question.title} is required`);
    }
    if (question.inputType === 'text' && typeof answer.textValue === 'string' && question.maxLength && answer.textValue.length > Number(question.maxLength)) {
      throw new Error(`${question.title} exceeds max length`);
    }
  }
}

function saveWeeklyAnswers(db: Database, weeklyFeedbackId: string, answers: Array<Record<string, unknown>>, time: string): void {
  db.prepare('DELETE FROM weekly_feedback_answers WHERE weeklyFeedbackId = ?').run(weeklyFeedbackId);
  for (const answer of answers) {
    const questionId = requiredString(answer, 'questionId');
    const selectedOptionIds = answerSelection(answer);
    const textValue = typeof answer.textValue === 'string' ? answer.textValue.trim() : '';
    if (selectedOptionIds.length > 0) {
      for (const optionId of selectedOptionIds) {
        db.prepare(
          'INSERT INTO weekly_feedback_answers (id, weeklyFeedbackId, questionId, optionId, textValue, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(createdId('weekly-answer'), weeklyFeedbackId, questionId, optionId, null, time, time);
      }
    } else {
      db.prepare(
        'INSERT INTO weekly_feedback_answers (id, weeklyFeedbackId, questionId, optionId, textValue, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(createdId('weekly-answer'), weeklyFeedbackId, questionId, null, textValue, time, time);
    }
  }
}

function count(db: Database, table: string): number {
  return Number((db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total);
}

function createdId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

const routes: Record<string, RouteMatch[]> = {
  GET: [
    {
      pattern: /^\/api\/roles$/,
      handler: ({ db }) => ({ data: normalizeRows(db.prepare('SELECT * FROM roles ORDER BY createdAt').all() as Array<Record<string, unknown>>) }),
    },
    {
      pattern: /^\/api\/roles\/([^/]+)\/permission-package$/,
      handler: ({ db }, match) => {
        const roleId = decodeURIComponent(match[1]);
        const role = normalizeRow(db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId) as Record<string, unknown> | undefined);
        if (!role) return { status: 404, error: 'Role not found' };
        const rows = normalizeRows(
          db
            .prepare(
              `SELECT pi.* FROM role_permission_items rpi
               JOIN permission_items pi ON pi.id = rpi.permissionItemId
               WHERE rpi.roleId = ? AND pi.enabled = 1
               ORDER BY rpi.sortOrder`,
            )
            .all(roleId) as Array<Record<string, unknown>>,
        );
        return {
          data: {
            role,
            requiredPermissions: rows.filter((item) => item.permissionType === 'required'),
            optionalPermissions: rows.filter((item) => item.permissionType === 'optional'),
          },
        };
      },
    },
    {
      pattern: /^\/api\/permission-items\/([^/]+)$/,
      handler: ({ db }, match) => {
        const item = getPermission(db, decodeURIComponent(match[1]));
        return item ? { data: item } : { status: 404, error: 'Permission item not found' };
      },
    },
    {
      pattern: /^\/api\/permission-items\/([^/]+)\/route$/,
      handler: ({ db }, match) => {
        const item = getPermission(db, decodeURIComponent(match[1]));
        if (!item) return { status: 404, error: 'Permission item not found' };
        return {
          data: {
            permissionItemId: item.id,
            applyUrl: item.applyUrl,
            reasonTemplate: item.reasonTemplate,
            approverName: item.approverName,
            ownerName: item.ownerName,
            commonWaitingReasons: item.commonWaitingReasons,
          },
        };
      },
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)$/,
      handler: ({ db }, match) => {
        const newcomer = normalizeRow(db.prepare('SELECT * FROM newcomers WHERE id = ?').get(decodeURIComponent(match[1])) as Record<string, unknown> | undefined);
        if (!newcomer) return { status: 404, error: 'Newcomer not found' };
        const taskStates = normalizeRows(
          db.prepare('SELECT * FROM newcomer_task_states WHERE newcomerId = ? ORDER BY createdAt').all(sqlValue(newcomer.id)) as Array<Record<string, unknown>>,
        );
        return { data: { ...newcomer, taskStates } };
      },
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/permission-progress$/,
      handler: ({ db }, match) => ({
        data: normalizeRows(
          db
            .prepare(
              `SELECT pp.*, pi.name AS permissionName, pi.ownerName
               FROM permission_progress pp
               JOIN permission_items pi ON pi.id = pp.permissionItemId
               WHERE pp.newcomerId = ?
               ORDER BY pp.createdAt`,
            )
            .all(decodeURIComponent(match[1])) as Array<Record<string, unknown>>,
        ),
      }),
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/follow-up-tasks$/,
      handler: ({ db }, match) => ({
        data: normalizeRows(
          db
            .prepare(
              `SELECT fut.*, pp.permissionItemId, pi.name AS permissionName, pi.permissionType
               FROM follow_up_tasks fut
               JOIN permission_progress pp ON pp.id = fut.permissionProgressId
               JOIN permission_items pi ON pi.id = pp.permissionItemId
               WHERE fut.newcomerId = ?
               ORDER BY fut.followUpAt`,
            )
            .all(decodeURIComponent(match[1])) as Array<Record<string, unknown>>,
        ),
      }),
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/follow-up-message-cards$/,
      handler: ({ db }, match) => ({
        data: normalizeRows(
          db
            .prepare(
              `SELECT fmc.*
               FROM follow_up_message_cards fmc
               WHERE fmc.newcomerId = ?
               ORDER BY fmc.sentAt`,
            )
            .all(decodeURIComponent(match[1])) as Array<Record<string, unknown>>,
        ),
      }),
    },
    {
      pattern: /^\/api\/d1-guide-config$/,
      handler: ({ db }) => ({ data: getD1GuideConfig(db) }),
    },
    {
      pattern: /^\/api\/weekly-feedback-config$/,
      handler: ({ db }) => ({ data: getWeeklyFeedbackConfig(db) }),
    },
    {
      pattern: /^\/api\/anonymous-feedback-config$/,
      handler: ({ db }) => ({ data: getAnonymousFeedbackConfig(db) }),
    },
    {
      pattern: /^\/api\/follow-up-tasks\/([^/]+)$/,
      handler: ({ db }, match) => {
        const row = normalizeRow(db.prepare('SELECT * FROM follow_up_tasks WHERE id = ?').get(decodeURIComponent(match[1])) as Record<string, unknown> | undefined);
        return row ? { data: row } : { status: 404, error: 'Follow-up task not found' };
      },
    },
    {
      pattern: /^\/api\/admin\/anonymous-feedbacks$/,
      handler: ({ db }) => ({
        data: normalizeRows(db.prepare('SELECT * FROM anonymous_feedbacks ORDER BY submittedAt DESC').all() as Array<Record<string, unknown>>).map((row) =>
          withAnonymousFeedbackDetail(db, row),
        ),
      }),
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/weekly-feedback$/,
      handler: ({ db }, match) => {
        const row = normalizeRow(
          db
            .prepare('SELECT * FROM weekly_feedbacks WHERE newcomerId = ? ORDER BY submittedAt DESC LIMIT 1')
            .get(decodeURIComponent(match[1])) as Record<string, unknown> | undefined,
        );
        return row ? { data: row } : { status: 404, error: 'Weekly feedback not found' };
      },
    },
    {
      pattern: /^\/api\/manager\/feedback\/([^/]+)$/,
      handler: ({ db }, match) => {
        const row = getWeeklyWithAction(db, decodeURIComponent(match[1]));
        return row ? { data: row } : { status: 404, error: 'Weekly feedback not found' };
      },
    },
    {
      pattern: /^\/api\/admin\/config$/,
      handler: ({ db }) => ({
        data: {
          roles: normalizeRows(db.prepare('SELECT * FROM roles ORDER BY createdAt').all() as Array<Record<string, unknown>>),
          permissionItems: normalizeRows(db.prepare('SELECT * FROM permission_items ORDER BY createdAt').all() as Array<Record<string, unknown>>),
          rolePermissionItems: normalizeRows(db.prepare('SELECT * FROM role_permission_items ORDER BY sortOrder').all() as Array<Record<string, unknown>>),
          d1GuideConfig: getD1GuideConfig(db),
          anonymousFeedbackConfig: getAnonymousFeedbackConfig(db),
          anonymousFeedbacks: normalizeRows(db.prepare('SELECT * FROM anonymous_feedbacks ORDER BY submittedAt DESC').all() as Array<Record<string, unknown>>).map((row) =>
            withAnonymousFeedbackDetail(db, row),
          ),
        },
      }),
    },
    {
      pattern: /^\/api\/admin\/knowledge-base-docs$/,
      handler: ({ db }) => ({
        data: normalizeRows(db.prepare('SELECT * FROM knowledge_base_docs ORDER BY updatedAt DESC').all() as Array<Record<string, unknown>>),
      }),
    },
    {
      pattern: /^\/api\/review\/metrics$/,
      handler: ({ db }) => ({
        data: {
          newcomerCount: count(db, 'newcomers'),
          submittedPermissionCount: Number(
            (db.prepare("SELECT COUNT(*) AS total FROM permission_progress WHERE status IN ('submitted', 'completed')").get() as { total: number }).total,
          ),
          pendingFollowUpCount: Number((db.prepare("SELECT COUNT(*) AS total FROM follow_up_tasks WHERE status = 'pending'").get() as { total: number }).total),
          anonymousFeedbackCount: count(db, 'anonymous_feedbacks'),
          weeklyFeedbackCount: count(db, 'weekly_feedbacks'),
          knowledgeDocCount: count(db, 'knowledge_base_docs'),
        },
      }),
    },
    {
      pattern: /^\/api\/admin\/weekly-feedback-analysis$/,
      handler: ({ db }) => {
        const questions = normalizeRows(
          db.prepare('SELECT * FROM weekly_feedback_questions WHERE enabled = 1 ORDER BY sortOrder').all() as Array<Record<string, unknown>>,
        );
        const options = normalizeRows(
          db.prepare('SELECT * FROM weekly_feedback_options WHERE enabled = 1 ORDER BY sortOrder').all() as Array<Record<string, unknown>>,
        );
        const counts = db
          .prepare(
            `SELECT questionId, optionId, COUNT(*) AS total
             FROM weekly_feedback_answers
             WHERE optionId IS NOT NULL
             GROUP BY questionId, optionId`,
          )
          .all() as Array<{ questionId: string; optionId: string; total: number }>;
        const countByOption = new Map(counts.map((item) => [`${item.questionId}:${item.optionId}`, Number(item.total)]));
        return {
          data: {
            submissionCount: count(db, 'weekly_feedbacks'),
            questions: questions.map((question) => ({
              questionKey: question.questionKey,
              title: question.title,
              inputType: question.inputType,
              options: options
                .filter((option) => option.questionId === question.id)
                .map((option) => ({
                  label: option.label,
                  count: countByOption.get(`${question.id}:${option.id}`) ?? 0,
                })),
            })),
          },
        };
      },
    },
  ],
  POST: [
    {
      pattern: /^\/api\/admin\/roles$/,
      handler: async ({ db, request }) => {
        const body = await readBody(request);
        const time = nowIso();
        const row = {
          id: typeof body.id === 'string' ? body.id : createdId('role'),
          name: requiredString(body, 'name'),
          department: requiredString(body, 'department'),
          description: requiredString(body, 'description'),
          createdAt: time,
          updatedAt: time,
        };
        db.prepare('INSERT INTO roles (id, name, department, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run(
          row.id,
          row.name,
          row.department,
          row.description,
          row.createdAt,
          row.updatedAt,
        );
        return { status: 201, data: row };
      },
    },
    {
      pattern: /^\/api\/admin\/role-permission-items$/,
      handler: async ({ db, request }) => {
        const body = await readBody(request);
        const time = nowIso();
        const row = {
          id: typeof body.id === 'string' ? body.id : createdId('rpi'),
          roleId: requiredString(body, 'roleId'),
          permissionItemId: requiredString(body, 'permissionItemId'),
          sortOrder: Number(body.sortOrder ?? 99),
          createdAt: time,
          updatedAt: time,
        };
        db.prepare('INSERT INTO role_permission_items (id, roleId, permissionItemId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run(
          row.id,
          row.roleId,
          row.permissionItemId,
          row.sortOrder,
          row.createdAt,
          row.updatedAt,
        );
        return { status: 201, data: row };
      },
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/permission-progress$/,
      handler: async ({ db, request }, match) => {
        const newcomerId = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const permissionItemId = requiredString(body, 'permissionItemId');
        const status = typeof body.status === 'string' ? body.status : 'submitted';
        if (!['submitted', 'completed', 'pending', 'rejected'].includes(status)) throw new Error('status is invalid');
        const permission = getPermission(db, permissionItemId);
        if (!permission) return { status: 404, error: 'Permission item not found' };

        const existing = db.prepare('SELECT * FROM permission_progress WHERE newcomerId = ? AND permissionItemId = ?').get(newcomerId, permissionItemId) as
          | Record<string, unknown>
          | undefined;
        const time = nowIso();
        const progressId = existing?.id ? String(existing.id) : createdId('progress');
        const submittedAt = status === 'submitted' || status === 'completed' ? time : null;
        if (existing) {
          db.prepare('UPDATE permission_progress SET status = ?, submittedAt = COALESCE(submittedAt, ?), lastActionAt = ?, updatedAt = ? WHERE id = ?').run(
            status,
            submittedAt,
            time,
            time,
            progressId,
          );
        } else {
          db.prepare(
            'INSERT INTO permission_progress (id, newcomerId, permissionItemId, status, submittedAt, completedAt, lastActionAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          ).run(progressId, newcomerId, permissionItemId, status, submittedAt, status === 'completed' ? time : null, time, time, time);
        }
        db.prepare('UPDATE newcomers SET permissionPackageViewed = 1, updatedAt = ? WHERE id = ?').run(time, newcomerId);

        let followUp = db.prepare('SELECT * FROM follow_up_tasks WHERE permissionProgressId = ?').get(progressId) as Record<string, unknown> | undefined;
        if ((status === 'submitted' || status === 'completed') && !followUp) {
          const followUpId = createdId('follow-up');
          const submitted = submittedAt ?? time;
          db.prepare(
            'INSERT INTO follow_up_tasks (id, newcomerId, permissionProgressId, submittedAt, followUpAt, status, ownerName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          ).run(followUpId, newcomerId, progressId, submitted, addHours(submitted, 4), 'pending', sqlValue(permission.ownerName), time, time);
          followUp = db.prepare('SELECT * FROM follow_up_tasks WHERE id = ?').get(followUpId) as Record<string, unknown>;
        }
        const progress = normalizeRow(db.prepare('SELECT * FROM permission_progress WHERE id = ?').get(progressId) as Record<string, unknown>);
        return { status: existing ? 200 : 201, data: { progress, followUpTask: normalizeRow(followUp) } };
      },
    },
    {
      pattern: /^\/api\/anonymous-feedbacks$/,
      handler: async ({ db, request }) => {
        const body = await readBody(request);
        const structured = resolveStructuredAnonymousFeedback(db, body);
        const type = structured?.typeLabel ?? requiredString(body, 'type');
        const module = structured?.moduleLabel ?? requiredString(body, 'module');
        const description = requiredString(body, 'description');
        const expectedAction = structured?.expectedActionLabel ?? requiredString(body, 'expectedAction');
        const time = nowIso();
        const feedbackNo = `AF-${time.slice(0, 10).replaceAll('-', '')}-${Math.floor(Math.random() * 900 + 100)}`;
        const row = {
          id: createdId('anon'),
          feedbackNo,
          type,
          module,
          description,
          expectedAction,
          isAnonymous: body.isAnonymous !== false,
          contactName: typeof body.contactName === 'string' ? body.contactName : null,
          contactInfo: typeof body.contactInfo === 'string' ? body.contactInfo : null,
          submittedByNewcomerId: typeof body.submittedByNewcomerId === 'string' ? body.submittedByNewcomerId : null,
          submittedAt: time,
          ownerName: '产品运营',
          status: 'open',
          result: '待处理',
          includedInReview: true,
          createdAt: time,
          updatedAt: time,
        };
        db.prepare(
          `INSERT INTO anonymous_feedbacks
           (id, feedbackNo, type, module, description, expectedAction, isAnonymous, contactName, contactInfo, submittedByNewcomerId, submittedAt, ownerName, status, result, includedInReview, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          row.id,
          row.feedbackNo,
          row.type,
          row.module,
          row.description,
          row.expectedAction,
          boolToDb(row.isAnonymous),
          row.contactName,
          row.contactInfo,
          row.submittedByNewcomerId,
          row.submittedAt,
          row.ownerName,
          row.status,
          row.result,
          boolToDb(row.includedInReview),
          row.createdAt,
          row.updatedAt,
        );
        if (structured) {
          db.prepare(
            `INSERT INTO anonymous_feedback_details
             (id, anonymousFeedbackId, moduleKey, problemTypeKey, problemTypeOtherText, expectedActionKeys, expectedActionOtherText, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            createdId('anon-detail'),
            row.id,
            structured.detail.moduleKey,
            structured.detail.problemTypeKey,
            structured.detail.problemTypeOtherText,
            JSON.stringify(structured.detail.expectedActionKeys),
            structured.detail.expectedActionOtherText,
            time,
            time,
          );
        }
        return { status: 201, data: withAnonymousFeedbackDetail(db, normalizeRow(row)!) };
      },
    },
    {
      pattern: /^\/api\/weekly-feedbacks$/,
      handler: async ({ db, request }) => {
        const body = await readBody(request);
        const newcomerId = requiredString(body, 'newcomerId');
        const structuredAnswers = Array.isArray(body.answers) ? (body.answers as Array<Record<string, unknown>>) : [];
        if (structuredAnswers.length > 0) validateWeeklyAnswers(db, structuredAnswers);
        const derived = structuredAnswers.length > 0 ? deriveWeeklyLegacyFields(db, structuredAnswers) : null;
        const submittedAt = nowIso();
        const row = {
          id: typeof body.id === 'string' ? body.id : createdId('weekly'),
          newcomerId,
          overallFeeling: derived?.overallFeeling || requiredString(body, 'overallFeeling'),
          blockers: derived?.blockers || requiredString(body, 'blockers'),
          supportNeeded: derived?.supportNeeded || requiredString(body, 'supportNeeded'),
          message: derived ? derived.message : requiredString(body, 'message'),
          visibleToManager: true,
          lifecycle: 'submitted',
          submittedAt,
        };
        db.prepare(
          `INSERT INTO weekly_feedbacks
           (id, newcomerId, overallFeeling, blockers, supportNeeded, message, visibleToManager, lifecycle, submittedAt, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          row.id,
          row.newcomerId,
          row.overallFeeling,
          row.blockers,
          row.supportNeeded,
          row.message,
          boolToDb(row.visibleToManager),
          row.lifecycle,
          row.submittedAt,
          row.submittedAt,
          row.submittedAt,
        );
        db.prepare('UPDATE newcomers SET weeklyFeedbackSubmitted = 1, updatedAt = ? WHERE id = ?').run(row.submittedAt, newcomerId);
        if (structuredAnswers.length > 0) saveWeeklyAnswers(db, row.id, structuredAnswers, row.submittedAt);
        const newcomer = normalizeRow(db.prepare('SELECT * FROM newcomers WHERE id = ?').get(newcomerId) as Record<string, unknown> | undefined);
        db.prepare(
          'INSERT INTO manager_feedback_actions (id, weeklyFeedbackId, managerName, managerViewed, managerViewedAt, managerActionStatus, actionNote, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(createdId('manager-action'), row.id, sqlValue(newcomer?.managerName ?? '直属经理'), 0, null, 'unread', '', row.submittedAt, row.submittedAt);
        return { status: 201, data: row };
      },
    },
    {
      pattern: /^\/api\/admin\/knowledge-base-docs$/,
      handler: async ({ db, request }) => {
        const body = await readBody(request);
        const time = nowIso();
        const row = {
          id: typeof body.id === 'string' ? body.id : createdId('kb'),
          title: requiredString(body, 'title'),
          category: requiredString(body, 'category'),
          applicableRole: requiredString(body, 'applicableRole'),
          applicableStage: requiredString(body, 'applicableStage'),
          sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : 'mock-drive://manual-entry',
          ownerName: requiredString(body, 'ownerName'),
          status: 'enabled',
          parseStatus: 'simulated',
          vectorStatus: 'simulated',
          hitCount: 0,
          updatedAt: time,
          createdAt: time,
        };
        db.prepare(
          `INSERT INTO knowledge_base_docs
           (id, title, category, applicableRole, applicableStage, sourceUrl, ownerName, status, parseStatus, vectorStatus, hitCount, updatedAt, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(...Object.values(row));
        return { status: 201, data: row };
      },
    },
    {
      pattern: /^\/api\/follow-up-message-cards\/dispatch$/,
      handler: async ({ db, request }) => {
        const body = await readBody(request);
        const currentTime = validIsoNow(body.now);
        const newcomerId = typeof body.newcomerId === 'string' && body.newcomerId.trim() ? body.newcomerId.trim() : null;
        const dueTasks = normalizeRows(
          db
            .prepare(
              `SELECT fut.*, pp.permissionItemId, pi.name AS permissionName
               FROM follow_up_tasks fut
               JOIN permission_progress pp ON pp.id = fut.permissionProgressId
               JOIN permission_items pi ON pi.id = pp.permissionItemId
               LEFT JOIN follow_up_message_cards fmc ON fmc.followUpTaskId = fut.id
               WHERE fut.status = 'pending'
                 AND fut.followUpAt <= ?
                 AND fmc.id IS NULL
                 AND (? IS NULL OR fut.newcomerId = ?)
               ORDER BY fut.followUpAt`,
            )
            .all(currentTime, newcomerId, newcomerId) as Array<Record<string, unknown>>,
        );

        const cards = dueTasks.map((task) => {
          const card = {
            id: createdId('follow-up-card'),
            followUpTaskId: String(task.id),
            newcomerId: String(task.newcomerId),
            permissionProgressId: String(task.permissionProgressId),
            permissionName: String(task.permissionName),
            deliveryChannel: 'feishu_message_card_simulated',
            deliveryStatus: 'simulated_sent',
            cardTitle: `${task.permissionName} 权限开通回访`,
            cardBody: `你申请的 ${task.permissionName} 权限现在有进展了吗？如果仍未完成，可以一键查看 Owner 和催办话术。`,
            actionUrl: `/follow-up/${task.id}`,
            scheduledAt: String(task.followUpAt),
            sentAt: currentTime,
            createdAt: currentTime,
            updatedAt: currentTime,
          };
          db.prepare(
            `INSERT INTO follow_up_message_cards
             (id, followUpTaskId, newcomerId, permissionProgressId, permissionName, deliveryChannel, deliveryStatus, cardTitle, cardBody, actionUrl, scheduledAt, sentAt, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            card.id,
            card.followUpTaskId,
            card.newcomerId,
            card.permissionProgressId,
            card.permissionName,
            card.deliveryChannel,
            card.deliveryStatus,
            card.cardTitle,
            card.cardBody,
            card.actionUrl,
            card.scheduledAt,
            card.sentAt,
            card.createdAt,
            card.updatedAt,
          );
          return card;
        });

        return { data: { sentCount: cards.length, cards } };
      },
    },
  ],
  PATCH: [
    {
      pattern: /^\/api\/admin\/permission-items\/([^/]+)$/,
      handler: async ({ db, request }, match) => {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = getPermission(db, id);
        if (!existing) return { status: 404, error: 'Permission item not found' };
        const time = nowIso();
        db.prepare(
          `UPDATE permission_items
           SET ownerName = ?, ownerContact = ?, applyUrl = ?, reasonTemplate = ?, approverName = ?, enabled = ?, updatedAt = ?
           WHERE id = ?`,
        ).run(
          sqlValue(typeof body.ownerName === 'string' ? body.ownerName : existing.ownerName),
          sqlValue(typeof body.ownerContact === 'string' ? body.ownerContact : existing.ownerContact),
          sqlValue(typeof body.applyUrl === 'string' ? body.applyUrl : existing.applyUrl),
          sqlValue(typeof body.reasonTemplate === 'string' ? body.reasonTemplate : existing.reasonTemplate),
          sqlValue(typeof body.approverName === 'string' ? body.approverName : existing.approverName),
          'enabled' in body ? boolToDb(body.enabled) : boolToDb(existing.enabled),
          time,
          id,
        );
        return { data: getPermission(db, id) };
      },
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/task-states\/([^/]+)$/,
      handler: async ({ db, request }, match) => {
        const newcomerId = decodeURIComponent(match[1]);
        const taskKey = decodeURIComponent(match[2]);
        const body = await readBody(request);
        const status = typeof body.status === 'string' ? body.status : 'completed';
        const time = nowIso();
        db.prepare('UPDATE newcomer_task_states SET status = ?, completedAt = ?, updatedAt = ? WHERE newcomerId = ? AND taskKey = ?').run(
          status,
          status === 'completed' ? time : null,
          time,
          newcomerId,
          taskKey,
        );
        if (taskKey === 'd1_guide') {
          db.prepare('UPDATE newcomers SET d1GuideCompleted = ?, updatedAt = ? WHERE id = ?').run(status === 'completed' ? 1 : 0, time, newcomerId);
        }
        const row = normalizeRow(
          db.prepare('SELECT * FROM newcomer_task_states WHERE newcomerId = ? AND taskKey = ?').get(newcomerId, taskKey) as
            | Record<string, unknown>
            | undefined,
        );
        return row ? { data: row } : { status: 404, error: 'Task state not found' };
      },
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)$/,
      handler: async ({ db, request }, match) => {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = normalizeRow(db.prepare('SELECT * FROM newcomers WHERE id = ?').get(id) as Record<string, unknown> | undefined);
        if (!existing) return { status: 404, error: 'Newcomer not found' };
        const time = nowIso();
        db.prepare(
          `UPDATE newcomers
           SET stage = ?, status = ?, d1GuideCompleted = ?, permissionPackageViewed = ?, weeklyFeedbackSubmitted = ?, managerViewedFeedback = ?, updatedAt = ?
           WHERE id = ?`,
        ).run(
          sqlValue(typeof body.stage === 'string' ? body.stage : existing.stage),
          sqlValue(typeof body.status === 'string' ? body.status : existing.status),
          'd1GuideCompleted' in body ? boolToDb(body.d1GuideCompleted) : boolToDb(existing.d1GuideCompleted),
          'permissionPackageViewed' in body ? boolToDb(body.permissionPackageViewed) : boolToDb(existing.permissionPackageViewed),
          'weeklyFeedbackSubmitted' in body ? boolToDb(body.weeklyFeedbackSubmitted) : boolToDb(existing.weeklyFeedbackSubmitted),
          'managerViewedFeedback' in body ? boolToDb(body.managerViewedFeedback) : boolToDb(existing.managerViewedFeedback),
          time,
          id,
        );
        return {
          data: normalizeRow(db.prepare('SELECT * FROM newcomers WHERE id = ?').get(id) as Record<string, unknown>),
        };
      },
    },
    {
      pattern: /^\/api\/follow-up-tasks\/([^/]+)$/,
      handler: async ({ db, request }, match) => {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = normalizeRow(db.prepare('SELECT * FROM follow_up_tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined);
        if (!existing) return { status: 404, error: 'Follow-up task not found' };
        const time = nowIso();
        db.prepare('UPDATE follow_up_tasks SET status = ?, updatedAt = ? WHERE id = ?').run(
          sqlValue(typeof body.status === 'string' ? body.status : existing.status),
          time,
          id,
        );
        return { data: normalizeRow(db.prepare('SELECT * FROM follow_up_tasks WHERE id = ?').get(id) as Record<string, unknown>) };
      },
    },
    {
      pattern: /^\/api\/admin\/weekly-feedback-config$/,
      handler: async ({ db, request }) => {
        const body = await readBody(request);
        const questions = Array.isArray(body.questions) ? (body.questions as Array<Record<string, unknown>>) : [];
        const time = nowIso();
        for (const question of questions) {
          const id = requiredString(question, 'id');
          if (typeof question.title === 'string' && question.title.trim()) {
            db.prepare('UPDATE weekly_feedback_questions SET title = ?, updatedAt = ? WHERE id = ?').run(question.title.trim(), time, id);
          }
          if (Array.isArray(question.options)) {
            for (const option of question.options as Array<Record<string, unknown>>) {
              const optionId = requiredString(option, 'id');
              if (typeof option.label === 'string' && option.label.trim()) {
                db.prepare('UPDATE weekly_feedback_options SET label = ?, updatedAt = ? WHERE id = ? AND questionId = ?').run(
                  option.label.trim(),
                  time,
                  optionId,
                  id,
                );
              }
            }
          }
        }
        return { data: getWeeklyFeedbackConfig(db) };
      },
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/permission-applications$/,
      handler: async ({ db, request }, match) => {
        const newcomerId = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const selectedPermissionItemIds = stringArray(body, 'selectedPermissionItemIds');
        const scopePermissionItemIds = stringArray(body, 'scopePermissionItemIds');
        const selectedSet = new Set(selectedPermissionItemIds);
        const time = nowIso();
        const removedPermissionItemIds: string[] = [];

        for (const permissionItemId of scopePermissionItemIds) {
          const existing = db
            .prepare('SELECT * FROM permission_progress WHERE newcomerId = ? AND permissionItemId = ?')
            .get(newcomerId, permissionItemId) as Record<string, unknown> | undefined;
          if (!selectedSet.has(permissionItemId) && existing?.status === 'pending') {
            db.prepare('DELETE FROM permission_progress WHERE id = ?').run(sqlValue(existing.id));
            removedPermissionItemIds.push(permissionItemId);
          }
        }

        for (const permissionItemId of selectedPermissionItemIds) {
          if (!scopePermissionItemIds.includes(permissionItemId)) continue;
          const permission = getPermission(db, permissionItemId);
          if (!permission) return { status: 404, error: 'Permission item not found' };
          const existing = db
            .prepare('SELECT * FROM permission_progress WHERE newcomerId = ? AND permissionItemId = ?')
            .get(newcomerId, permissionItemId) as Record<string, unknown> | undefined;
          if (existing) {
            if (existing.status === 'pending') {
              db.prepare('UPDATE permission_progress SET status = ?, submittedAt = COALESCE(submittedAt, ?), lastActionAt = ?, updatedAt = ? WHERE id = ?').run(
                'submitted',
                time,
                time,
                time,
                sqlValue(existing.id),
              );
            }
          } else {
            db.prepare(
              'INSERT INTO permission_progress (id, newcomerId, permissionItemId, status, submittedAt, completedAt, lastActionAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ).run(createdId('progress'), newcomerId, permissionItemId, 'submitted', time, null, time, time, time);
          }
          const progress = db
            .prepare('SELECT * FROM permission_progress WHERE newcomerId = ? AND permissionItemId = ?')
            .get(newcomerId, permissionItemId) as Record<string, unknown>;
          const existingFollowUp = db.prepare('SELECT * FROM follow_up_tasks WHERE permissionProgressId = ?').get(sqlValue(progress.id));
          if (!existingFollowUp) {
            db.prepare(
              'INSERT INTO follow_up_tasks (id, newcomerId, permissionProgressId, submittedAt, followUpAt, status, ownerName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ).run(createdId('follow-up'), newcomerId, sqlValue(progress.id), time, addHours(time, 4), 'pending', sqlValue(permission.ownerName), time, time);
          }
        }

        db.prepare('UPDATE newcomers SET permissionPackageViewed = 1, updatedAt = ? WHERE id = ?').run(time, newcomerId);
        return { data: { selectedPermissionItemIds, removedPermissionItemIds } };
      },
    },
    {
      pattern: /^\/api\/admin\/anonymous-feedbacks\/([^/]+)$/,
      handler: async ({ db, request }, match) => {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = normalizeRow(db.prepare('SELECT * FROM anonymous_feedbacks WHERE id = ?').get(id) as Record<string, unknown> | undefined);
        if (!existing) return { status: 404, error: 'Anonymous feedback not found' };
        const time = nowIso();
        db.prepare('UPDATE anonymous_feedbacks SET status = ?, result = ?, includedInReview = ?, updatedAt = ? WHERE id = ?').run(
          sqlValue(typeof body.status === 'string' ? body.status : existing.status),
          sqlValue(typeof body.result === 'string' ? body.result : existing.result),
          'includedInReview' in body ? boolToDb(body.includedInReview) : boolToDb(existing.includedInReview),
          time,
          id,
        );
        return { data: normalizeRow(db.prepare('SELECT * FROM anonymous_feedbacks WHERE id = ?').get(id) as Record<string, unknown>) };
      },
    },
    {
      pattern: /^\/api\/manager\/feedback\/([^/]+)\/action$/,
      handler: async ({ db, request }, match) => {
        const weeklyFeedbackId = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = normalizeRow(
          db.prepare('SELECT * FROM manager_feedback_actions WHERE weeklyFeedbackId = ?').get(weeklyFeedbackId) as Record<string, unknown> | undefined,
        );
        if (!existing) return { status: 404, error: 'Manager action not found' };
        const time = nowIso();
        db.prepare(
          'UPDATE manager_feedback_actions SET managerViewed = 1, managerViewedAt = COALESCE(managerViewedAt, ?), managerActionStatus = ?, actionNote = ?, updatedAt = ? WHERE weeklyFeedbackId = ?',
        ).run(
          time,
          sqlValue(typeof body.managerActionStatus === 'string' ? body.managerActionStatus : existing.managerActionStatus),
          sqlValue(typeof body.actionNote === 'string' ? body.actionNote : existing.actionNote),
          time,
          weeklyFeedbackId,
        );
        db.prepare(
          `UPDATE newcomers
           SET managerViewedFeedback = 1, updatedAt = ?
           WHERE id = (SELECT newcomerId FROM weekly_feedbacks WHERE id = ?)`,
        ).run(time, weeklyFeedbackId);
        return {
          data: normalizeRow(db.prepare('SELECT * FROM manager_feedback_actions WHERE weeklyFeedbackId = ?').get(weeklyFeedbackId) as Record<string, unknown>),
        };
      },
    },
    {
      pattern: /^\/api\/admin\/config$/,
      handler: async ({ request }) => {
        await readBody(request);
        return { data: { status: 'accepted', note: 'Use specific admin endpoints to update role and permission configuration.' } };
      },
    },
  ],
};

async function handleApiRequest(context: ApiContext): Promise<ApiResult> {
  const matches = routes[context.method] ?? [];
  for (const route of matches) {
    const match = context.pathname.match(route.pattern);
    if (match) return route.handler(context, match);
  }
  return { status: 404, error: 'Route not found' };
}

function writeJson(response: http.ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  response.end(JSON.stringify(payload));
}

export async function createApiServer(options: { db: Database; port?: number }): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(async (request, response) => {
    response.setHeader('access-control-allow-origin', '*');
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      response.end();
      return;
    }

    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (!url.pathname.startsWith('/api/')) {
        writeJson(response, 404, { error: 'Only /api routes are served by the backend.' });
        return;
      }
      const result = await handleApiRequest({
        db: options.db,
        method: request.method ?? 'GET',
        pathname: url.pathname,
        request,
        response,
      });
      if (result.error) {
        writeJson(response, result.status ?? 400, { error: result.error });
      } else {
        writeJson(response, result.status ?? 200, { data: result.data });
      }
    } catch (error) {
      writeJson(response, 400, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 4000, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : options.port ?? 4000;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          try {
            options.db.close();
          } catch {
            // The HTTP server may own the only open handle during tests.
          }
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
