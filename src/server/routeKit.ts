import http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { SQLInputValue } from 'node:sqlite';

import { boolFromDb, boolToDb, nowIso, type Database } from './db.ts';

export { boolToDb, nowIso };

export type ApiContext = {
  db: Database;
  method: string;
  pathname: string;
  request: http.IncomingMessage;
  response: http.ServerResponse;
};

export type ApiResult = {
  status?: number;
  data?: unknown;
  error?: string;
};

export type RouteMatch = {
  pattern: RegExp;
  handler: (context: ApiContext, match: RegExpMatchArray) => Promise<ApiResult> | ApiResult;
};

export function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function normalizeRow<T extends Record<string, unknown>>(row: T | undefined): Record<string, unknown> | undefined {
  if (!row) return undefined;
  const next: Record<string, unknown> = { ...row };
  for (const key of ['sensitive', 'enabled', 'required', 'requiresText', 'd1GuideCompleted', 'permissionPackageViewed', 'weeklyFeedbackSubmitted', 'managerViewedFeedback', 'isAnonymous', 'includedInReview', 'visibleToManager', 'managerViewed']) {
    if (key in next) next[key] = boolFromDb(next[key]);
  }
  if ('commonWaitingReasons' in next) next.commonWaitingReasons = parseJsonArray(next.commonWaitingReasons);
  if ('expectedActionKeys' in next) next.expectedActionKeys = parseJsonArray(next.expectedActionKeys);
  return next;
}

export function normalizeRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => normalizeRow(row)!);
}

export async function readBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
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

export function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

export function stringArray(body: Record<string, unknown>, key: string): string[] {
  const value = body[key];
  if (!Array.isArray(value)) throw new Error(`${key} is required`);
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim());
}

export function sqlValue(value: unknown): SQLInputValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'boolean') return boolToDb(value);
  return String(value);
}

export function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function validIsoNow(value: unknown): string {
  if (typeof value !== 'string') return nowIso();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('now is invalid');
  return date.toISOString();
}

export function getPermission(db: Database, id: string): Record<string, unknown> | undefined {
  return normalizeRow(db.prepare('SELECT * FROM permission_items WHERE id = ?').get(id) as Record<string, unknown> | undefined);
}

export function getWeeklyWithAction(db: Database, weeklyFeedbackId: string): Record<string, unknown> | undefined {
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

export function getD1GuideConfig(db: Database): Record<string, unknown> {
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

export function getWeeklyFeedbackConfig(db: Database): Record<string, unknown> {
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

export function getAnonymousFeedbackConfig(db: Database): Record<string, unknown> {
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

export function getAnonymousFeedbackDetail(db: Database, anonymousFeedbackId: string): Record<string, unknown> | null {
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

export function withAnonymousFeedbackDetail(db: Database, row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, detail: getAnonymousFeedbackDetail(db, String(row.id)) };
}

export function resolveStructuredAnonymousFeedback(
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

export function optionLabels(db: Database, optionIds: string[]): string[] {
  if (optionIds.length === 0) return [];
  return optionIds
    .map((id) => db.prepare('SELECT label FROM weekly_feedback_options WHERE id = ?').get(id) as { label: string } | undefined)
    .filter((item): item is { label: string } => Boolean(item))
    .map((item) => item.label);
}

export function answerSelection(answer: Record<string, unknown>): string[] {
  return Array.isArray(answer.selectedOptionIds)
    ? answer.selectedOptionIds.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim())
    : [];
}

export function deriveWeeklyLegacyFields(
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

export function validateWeeklyAnswers(db: Database, answers: Array<Record<string, unknown>>): void {
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

export function saveWeeklyAnswers(db: Database, weeklyFeedbackId: string, answers: Array<Record<string, unknown>>, time: string): void {
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

export function count(db: Database, table: string): number {
  return Number((db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total);
}

export function createdId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
