import type { Database } from '../db.ts';
import type { WeeklyAnswerInput } from '../contracts.ts';
import { badRequest } from '../errors.ts';
import { createdId, normalizeRow, requiredString, sqlValue, stringArray } from '../routeKit.ts';

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
  if (!module) throw badRequest('moduleKey is invalid');
  const problemType = normalizeRow(
    db
      .prepare('SELECT * FROM anonymous_feedback_problem_types WHERE moduleId = ? AND typeKey = ? AND enabled = 1')
      .get(sqlValue(module.id), problemTypeKey) as Record<string, unknown> | undefined,
  );
  if (!problemType) throw badRequest('problemTypeKey is invalid');
  const problemTypeOtherText = typeof body.problemTypeOtherText === 'string' ? body.problemTypeOtherText.trim() : '';
  if (problemType.requiresText && problemTypeOtherText.length === 0) throw badRequest('problemTypeOtherText is required');
  const actionRows = expectedActionKeys.map((actionKey) =>
    normalizeRow(
      db
        .prepare('SELECT * FROM anonymous_feedback_expected_actions WHERE moduleId = ? AND actionKey = ? AND enabled = 1')
        .get(sqlValue(module.id), actionKey) as Record<string, unknown> | undefined,
    ),
  );
  if (actionRows.some((row) => !row)) throw badRequest('expectedActionKeys is invalid');
  const expectedActionOtherText = typeof body.expectedActionOtherText === 'string' ? body.expectedActionOtherText.trim() : '';
  for (const action of actionRows) {
    if (action?.requiresText && expectedActionOtherText.length === 0) throw badRequest('expectedActionOtherText is required');
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

export function answerSelection(answer: WeeklyAnswerInput | Record<string, unknown>): string[] {
  return Array.isArray(answer.selectedOptionIds)
    ? answer.selectedOptionIds.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim())
    : [];
}

export function deriveWeeklyLegacyFields(
  db: Database,
  answers: WeeklyAnswerInput[],
): { overallFeeling: string; blockers: string; supportNeeded: string; message: string; workSummary: string } {
  const questions = db.prepare('SELECT id, questionKey, title FROM weekly_feedback_questions').all() as Array<{ id: string; questionKey: string; title: string }>;
  const byId = new Map(questions.map((question) => [question.id, question.questionKey]));
  const titleById = new Map(questions.map((question) => [question.id, question.title]));
  const byKey = new Map<string, Record<string, unknown>>();
  let workSummaryAnswer: Record<string, unknown> | undefined;
  for (const answer of answers) {
    const questionId = typeof answer.questionId === 'string' ? answer.questionId : '';
    const key = byId.get(questionId);
    if (key) byKey.set(key, answer);
    if (key === 'work_summary' || titleById.get(questionId) === '首周工作摘要') workSummaryAnswer = answer;
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
    workSummary: typeof workSummaryAnswer?.textValue === 'string' ? workSummaryAnswer.textValue.trim() : '',
  };
}

export function validateWeeklyAnswers(db: Database, answers: WeeklyAnswerInput[]): void {
  const questions = db.prepare('SELECT * FROM weekly_feedback_questions WHERE enabled = 1 ORDER BY sortOrder').all() as Array<Record<string, unknown>>;
  const options = db.prepare('SELECT id, questionId FROM weekly_feedback_options WHERE enabled = 1').all() as Array<{ id: string; questionId: string }>;
  const optionQuestionById = new Map(options.map((option) => [option.id, option.questionId]));
  const byQuestionId = new Map(answers.map((answer) => [String(answer.questionId), answer]));
  for (const question of questions) {
    const answer = byQuestionId.get(String(question.id));
    if (question.required && !answer) throw badRequest(`${question.title} is required`);
    if (!answer) continue;
    if (question.inputType === 'single' && answerSelection(answer).length !== 1) throw badRequest(`${question.title} must select one option`);
    if (question.inputType === 'multi' && question.required && answerSelection(answer).length === 0) throw badRequest(`${question.title} must select at least one option`);
    for (const optionId of answerSelection(answer)) {
      if (optionQuestionById.get(optionId) !== question.id) throw badRequest(`${question.title} has invalid option`);
    }
    if (question.inputType === 'text' && question.required && (typeof answer.textValue !== 'string' || answer.textValue.trim().length === 0)) {
      throw badRequest(`${question.title} is required`);
    }
    if (question.inputType === 'text' && typeof answer.textValue === 'string' && question.maxLength && answer.textValue.length > Number(question.maxLength)) {
      throw badRequest(`${question.title} exceeds max length`);
    }
  }
}

export function saveWeeklyAnswers(db: Database, weeklyFeedbackId: string, answers: WeeklyAnswerInput[], time: string): void {
  db.prepare('DELETE FROM weekly_feedback_answers WHERE weeklyFeedbackId = ?').run(weeklyFeedbackId);
  for (const answer of answers) {
    const questionId = answer.questionId.trim();
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
