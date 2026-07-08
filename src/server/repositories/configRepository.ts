import type { Database } from '../db.ts';
import { normalizeRows } from '../routeKit.ts';

const DEFAULT_NEWCOMER_ROLE_ID = 'role-product-intern';

function roleScope(db: Database, roleId?: string | null): { roleId?: string; roleName?: string; departmentId?: string; departmentName?: string } {
  const effectiveRoleId = roleId || DEFAULT_NEWCOMER_ROLE_ID;
  const row = db.prepare('SELECT id, name, departmentId, department FROM roles WHERE id = ?').get(effectiveRoleId) as
    | { id: string; name: string; departmentId?: string; department?: string }
    | undefined;
  if (!row) return { roleId: effectiveRoleId };
  return {
    roleId: row.id,
    roleName: row.name,
    departmentId: row.departmentId,
    departmentName: row.department,
  };
}

function scopeMatches(row: Record<string, unknown>, scope: ReturnType<typeof roleScope>): boolean {
  const rowRoleId = String(row.roleId ?? '').trim();
  const rowDepartmentId = String(row.departmentId ?? '').trim();
  const rowDepartmentName = String(row.departmentName ?? '').trim();
  if (rowRoleId && scope.roleId) return rowRoleId === scope.roleId;
  if (rowDepartmentId && scope.departmentId && rowDepartmentId !== scope.departmentId) return false;
  if (rowDepartmentName && scope.departmentName && rowDepartmentName !== scope.departmentName) return false;
  return true;
}

function shapeD1GuideConfig(rows: Array<Record<string, unknown>>): Record<string, unknown> {
  const byKey = Object.fromEntries(rows.map((row) => [String(row.actionKey), row]));
  return {
    items: rows,
    joinGroup: byKey.join_group ?? rows.find((row) => row.taskType === 'join_group') ?? null,
    employeeGuide: byKey.employee_guide ?? rows.find((row) => row.taskType === 'employee_guide') ?? null,
    permissionPackage: byKey.permission_package ?? rows.find((row) => row.taskType === 'permission_package') ?? null,
  };
}

export function getD1GuideConfig(db: Database, roleId?: string | null): Record<string, unknown> {
  const scope = roleScope(db, roleId);
  const rows = normalizeRows(
    db.prepare('SELECT * FROM d1_guide_configs WHERE enabled = 1 ORDER BY sortOrder').all() as Array<Record<string, unknown>>,
  ).filter((row) => scopeMatches(row, scope));
  return shapeD1GuideConfig(rows);
}

export function getAdminD1GuideConfig(db: Database): Record<string, unknown> {
  const rows = normalizeRows(db.prepare('SELECT * FROM d1_guide_configs ORDER BY sortOrder').all() as Array<Record<string, unknown>>);
  return shapeD1GuideConfig(rows);
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

export function getAdminAnonymousFeedbackConfig(db: Database): Record<string, unknown> {
  const modules = normalizeRows(db.prepare('SELECT * FROM anonymous_feedback_modules ORDER BY sortOrder').all() as Array<Record<string, unknown>>);
  const problemTypes = normalizeRows(db.prepare('SELECT * FROM anonymous_feedback_problem_types ORDER BY sortOrder').all() as Array<Record<string, unknown>>);
  const expectedActions = normalizeRows(db.prepare('SELECT * FROM anonymous_feedback_expected_actions ORDER BY sortOrder').all() as Array<Record<string, unknown>>);
  return {
    modules: modules.map((module) => ({
      ...module,
      problemTypes: problemTypes.filter((item) => item.moduleId === module.id),
      expectedActions: expectedActions.filter((item) => item.moduleId === module.id),
    })),
  };
}
