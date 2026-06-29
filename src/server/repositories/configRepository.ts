import type { Database } from '../db.ts';
import { normalizeRows } from '../routeKit.ts';

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

export function getAdminWeeklyFeedbackConfig(db: Database): Record<string, unknown> {
  const questions = normalizeRows(db.prepare('SELECT * FROM weekly_feedback_questions ORDER BY sortOrder').all() as Array<Record<string, unknown>>);
  const options = normalizeRows(db.prepare('SELECT * FROM weekly_feedback_options ORDER BY sortOrder').all() as Array<Record<string, unknown>>);
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
