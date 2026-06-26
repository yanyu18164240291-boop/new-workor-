import type { RouteMatch } from '../routeKit.ts';
import { isPermissionType, parseAnonymousFeedbackStatus } from '../contracts.ts';
import { badRequest } from '../errors.ts';
import {
  boolToDb,
  createdId,
  normalizeRow,
  normalizeRows,
  nowIso,
  readBody,
  requiredString,
  sqlValue
} from '../routeKit.ts';
import { getAnonymousFeedbackConfig, getD1GuideConfig, getWeeklyFeedbackConfig } from '../repositories/configRepository.ts';
import { withAnonymousFeedbackDetail } from '../repositories/feedbackRepository.ts';
import { count } from '../repositories/metricsRepository.ts';
import { getPermission } from '../repositories/permissionRepository.ts';

const demoAdmin = 'demo-admin';

export const listAdminAnonymousFeedbacks: RouteMatch['handler'] = ({ db }) => ({
        data: normalizeRows(db.prepare('SELECT * FROM anonymous_feedbacks ORDER BY submittedAt DESC').all() as Array<Record<string, unknown>>).map((row) =>
          withAnonymousFeedbackDetail(db, row),
        ),
      });

export const getAdminConfig: RouteMatch['handler'] = ({ db }) => ({
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
      });

export const listKnowledgeBaseDocs: RouteMatch['handler'] = ({ db }) => ({
        data: normalizeRows(db.prepare('SELECT * FROM knowledge_base_docs ORDER BY updatedAt DESC').all() as Array<Record<string, unknown>>),
      });

export const getWeeklyFeedbackAnalysis: RouteMatch['handler'] = ({ db }) => {
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
      };

function optionalString(body: Record<string, unknown>, key: string, fallback: unknown): string {
  const value = body[key];
  if (!(key in body)) return String(fallback ?? '');
  if (typeof value !== 'string' || value.trim() === '') throw badRequest(`${key} is required`);
  return value.trim();
}

function optionalNullableString(body: Record<string, unknown>, key: string, fallback: unknown): string | null {
  if (key in body && (body[key] === null || body[key] === undefined)) return null;
  const value = body[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return fallback === null || fallback === undefined ? null : String(fallback);
}

function parseCommonWaitingReasons(value: unknown, fallback: unknown): string {
  if (Array.isArray(value)) {
    const reasons = value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim());
    return JSON.stringify(reasons);
  }
  if (typeof value === 'string') {
    const reasons = value
      .split(/\r?\n|、|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    return JSON.stringify(reasons);
  }
  return JSON.stringify(Array.isArray(fallback) ? fallback : []);
}

function adminActor(body: Record<string, unknown>): string {
  return typeof body.updatedBy === 'string' && body.updatedBy.trim() ? body.updatedBy.trim() : demoAdmin;
}

function assertAdminUrl(value: string, key: string, allowedSchemes: string[]): void {
  if (allowedSchemes.some((scheme) => value.startsWith(scheme))) return;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return;
  } catch {
    // Fall through to the product-facing validation error.
  }
  throw badRequest(`${key} is invalid`);
}

function assertExists(db: Parameters<RouteMatch['handler']>[0]['db'], table: string, id: string, label: string): void {
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
  if (!row) throw badRequest(`${label} is invalid`);
}

function assertPermissionType(value: unknown, fallback: unknown): 'required' | 'optional' {
  const type = typeof value === 'string' ? value : fallback;
  if (!isPermissionType(type)) throw badRequest('permissionType is invalid');
  return type;
}

function assertD1GuideItem(actionKey: string, item: Record<string, unknown>): void {
  if (actionKey === 'join_group') {
    if (typeof item.applyUrl === 'string' && item.applyUrl.trim() && !item.applyUrl.trim().startsWith('mock-feishu://chat/')) {
      throw badRequest('join_group applyUrl must remain a simulated Feishu chat URL');
    }
  }
  if (actionKey === 'employee_guide') {
    if (typeof item.documentUrl === 'string' && item.documentUrl.trim() && !item.documentUrl.trim().startsWith('mock-feishu://doc/')) {
      throw badRequest('employee_guide documentUrl must remain a simulated Feishu doc URL');
    }
  }
  if (actionKey === 'permission_package') {
    const routePath = typeof item.routePath === 'string' ? item.routePath.trim() : '';
    if (routePath && routePath !== '/permissions') throw badRequest('permission_package routePath must stay /permissions');
  }
}

function assertWeeklyConfigStillHasQuestion(db: Parameters<RouteMatch['handler']>[0]['db'], questions: Array<Record<string, unknown>>): void {
  const existing = db.prepare('SELECT id, enabled FROM weekly_feedback_questions').all() as Array<{ id: string; enabled: number }>;
  const enabledById = new Map(existing.map((question) => [question.id, Boolean(question.enabled)]));
  for (const question of questions) {
    if (typeof question.id === 'string' && 'enabled' in question) {
      enabledById.set(question.id, Boolean(question.enabled));
    }
  }
  if (![...enabledById.values()].some(Boolean)) throw badRequest('weekly feedback config must keep at least one enabled question');
}

export const createRole: RouteMatch['handler'] = async ({ db, request }) => {
        const body = await readBody(request);
        const time = nowIso();
        const row = {
          id: typeof body.id === 'string' ? body.id : createdId('role'),
          name: requiredString(body, 'name'),
          department: requiredString(body, 'department'),
          description: requiredString(body, 'description'),
          createdAt: time,
          updatedAt: time,
          updatedBy: adminActor(body),
        };
        db.prepare('INSERT INTO roles (id, name, department, description, createdAt, updatedAt, updatedBy) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          row.id,
          row.name,
          row.department,
          row.description,
          row.createdAt,
          row.updatedAt,
          row.updatedBy,
        );
        return { status: 201, data: row };
      };

export const updateRole: RouteMatch['handler'] = async ({ db, request }, match) => {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = normalizeRow(db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as Record<string, unknown> | undefined);
        if (!existing) return { status: 404, error: 'Role not found' };
        const time = nowIso();
        db.prepare('UPDATE roles SET name = ?, department = ?, description = ?, updatedAt = ?, updatedBy = ? WHERE id = ?').run(
          sqlValue(optionalString(body, 'name', existing.name)),
          sqlValue(optionalString(body, 'department', existing.department)),
          sqlValue(optionalString(body, 'description', existing.description)),
          time,
          adminActor(body),
          id,
        );
        return { data: normalizeRow(db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as Record<string, unknown>) };
      };

export const createPermissionItem: RouteMatch['handler'] = async ({ db, request }) => {
        const body = await readBody(request);
        const time = nowIso();
        const row = {
          id: typeof body.id === 'string' ? body.id : createdId('perm'),
          name: requiredString(body, 'name'),
          category: requiredString(body, 'category'),
          permissionType: assertPermissionType(body.permissionType, 'optional'),
          sensitive: 'sensitive' in body ? boolToDb(body.sensitive) : 0,
          ownerName: requiredString(body, 'ownerName'),
          ownerContact: requiredString(body, 'ownerContact'),
          applyUrl: requiredString(body, 'applyUrl'),
          reasonTemplate: requiredString(body, 'reasonTemplate'),
          approverName: requiredString(body, 'approverName'),
          commonWaitingReasons: parseCommonWaitingReasons(body.commonWaitingReasons, []),
          enabled: 'enabled' in body ? boolToDb(body.enabled) : 1,
          createdAt: time,
          updatedAt: time,
          updatedBy: adminActor(body),
        };
        assertAdminUrl(row.applyUrl, 'applyUrl', ['mock-feishu://approval/']);
        db.prepare(
          `INSERT INTO permission_items
           (id, name, category, permissionType, sensitive, ownerName, ownerContact, applyUrl, reasonTemplate, approverName, commonWaitingReasons, enabled, createdAt, updatedAt, updatedBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          row.id,
          row.name,
          row.category,
          row.permissionType,
          row.sensitive,
          row.ownerName,
          row.ownerContact,
          row.applyUrl,
          row.reasonTemplate,
          row.approverName,
          row.commonWaitingReasons,
          row.enabled,
          row.createdAt,
          row.updatedAt,
          row.updatedBy,
        );
        return { status: 201, data: getPermission(db, row.id) };
      };

export const createRolePermissionItem: RouteMatch['handler'] = async ({ db, request }) => {
        const body = await readBody(request);
        const time = nowIso();
        const row = {
          id: typeof body.id === 'string' ? body.id : createdId('rpi'),
          roleId: requiredString(body, 'roleId'),
          permissionItemId: requiredString(body, 'permissionItemId'),
          sortOrder: Number(body.sortOrder ?? 99),
          createdAt: time,
          updatedAt: time,
          updatedBy: adminActor(body),
        };
        assertExists(db, 'roles', row.roleId, 'roleId');
        assertExists(db, 'permission_items', row.permissionItemId, 'permissionItemId');
        const duplicate = db.prepare('SELECT id FROM role_permission_items WHERE roleId = ? AND permissionItemId = ?').get(row.roleId, row.permissionItemId);
        if (duplicate) throw badRequest('duplicate role permission binding');
        db.prepare('INSERT INTO role_permission_items (id, roleId, permissionItemId, sortOrder, createdAt, updatedAt, updatedBy) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          row.id,
          row.roleId,
          row.permissionItemId,
          row.sortOrder,
          row.createdAt,
          row.updatedAt,
          row.updatedBy,
        );
        return { status: 201, data: row };
      };

export const createKnowledgeBaseDoc: RouteMatch['handler'] = async ({ db, request }) => {
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
          updatedBy: adminActor(body),
        };
        assertAdminUrl(row.sourceUrl, 'sourceUrl', ['mock-drive://']);
        db.prepare(
          `INSERT INTO knowledge_base_docs
           (id, title, category, applicableRole, applicableStage, sourceUrl, ownerName, status, parseStatus, vectorStatus, hitCount, updatedAt, createdAt, updatedBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(...Object.values(row));
        return { status: 201, data: row };
      };

export const updatePermissionItem: RouteMatch['handler'] = async ({ db, request }, match) => {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = getPermission(db, id);
        if (!existing) return { status: 404, error: 'Permission item not found' };
        const time = nowIso();
        const permissionType = assertPermissionType(body.permissionType, existing.permissionType);
        const applyUrl = typeof body.applyUrl === 'string' ? body.applyUrl.trim() : String(existing.applyUrl ?? '');
        assertAdminUrl(applyUrl, 'applyUrl', ['mock-feishu://approval/']);
        db.prepare(
          `UPDATE permission_items
           SET name = ?, category = ?, permissionType = ?, sensitive = ?, ownerName = ?, ownerContact = ?, applyUrl = ?, reasonTemplate = ?, approverName = ?, commonWaitingReasons = ?, enabled = ?, updatedAt = ?, updatedBy = ?
           WHERE id = ?`,
        ).run(
          sqlValue(optionalString(body, 'name', existing.name)),
          sqlValue(optionalString(body, 'category', existing.category)),
          permissionType,
          'sensitive' in body ? boolToDb(body.sensitive) : boolToDb(existing.sensitive),
          sqlValue(typeof body.ownerName === 'string' ? body.ownerName : existing.ownerName),
          sqlValue(typeof body.ownerContact === 'string' ? body.ownerContact : existing.ownerContact),
          sqlValue(applyUrl),
          sqlValue(typeof body.reasonTemplate === 'string' ? body.reasonTemplate : existing.reasonTemplate),
          sqlValue(typeof body.approverName === 'string' ? body.approverName : existing.approverName),
          parseCommonWaitingReasons(body.commonWaitingReasons, existing.commonWaitingReasons),
          'enabled' in body ? boolToDb(body.enabled) : boolToDb(existing.enabled),
          time,
          adminActor(body),
          id,
        );
        return { data: getPermission(db, id) };
      };

export const updateWeeklyFeedbackConfig: RouteMatch['handler'] = async ({ db, request }) => {
        const body = await readBody(request);
        const questions = Array.isArray(body.questions) ? (body.questions as Array<Record<string, unknown>>) : [];
        const time = nowIso();
        assertWeeklyConfigStillHasQuestion(db, questions);
        for (const question of questions) {
          const id = requiredString(question, 'id');
          assertExists(db, 'weekly_feedback_questions', id, 'questionId');
          if (typeof question.title === 'string' && question.title.trim()) {
            db.prepare('UPDATE weekly_feedback_questions SET title = ?, description = ?, required = ?, maxLength = ?, enabled = ?, updatedAt = ?, updatedBy = ? WHERE id = ?').run(
              question.title.trim(),
              'description' in question ? optionalNullableString(question, 'description', null) : sqlValue((db.prepare('SELECT description FROM weekly_feedback_questions WHERE id = ?').get(id) as { description?: string | null }).description),
              'required' in question ? boolToDb(question.required) : sqlValue((db.prepare('SELECT required FROM weekly_feedback_questions WHERE id = ?').get(id) as { required: number }).required),
              'maxLength' in question ? (question.maxLength === null ? null : Number(question.maxLength)) : sqlValue((db.prepare('SELECT maxLength FROM weekly_feedback_questions WHERE id = ?').get(id) as { maxLength?: number | null }).maxLength),
              'enabled' in question ? boolToDb(question.enabled) : sqlValue((db.prepare('SELECT enabled FROM weekly_feedback_questions WHERE id = ?').get(id) as { enabled: number }).enabled),
              time,
              adminActor(body),
              id,
            );
          }
          if (Array.isArray(question.options)) {
            for (const option of question.options as Array<Record<string, unknown>>) {
              const optionId = requiredString(option, 'id');
              assertExists(db, 'weekly_feedback_options', optionId, 'optionId');
              if (typeof option.label === 'string' && option.label.trim()) {
                db.prepare('UPDATE weekly_feedback_options SET label = ?, enabled = ?, updatedAt = ?, updatedBy = ? WHERE id = ? AND questionId = ?').run(
                  option.label.trim(),
                  'enabled' in option ? boolToDb(option.enabled) : sqlValue((db.prepare('SELECT enabled FROM weekly_feedback_options WHERE id = ?').get(optionId) as { enabled: number }).enabled),
                  time,
                  adminActor(body),
                  optionId,
                  id,
                );
              }
            }
          }
        }
        return { data: getWeeklyFeedbackConfig(db) };
      };

export const updateD1GuideConfig: RouteMatch['handler'] = async ({ db, request }) => {
        const body = await readBody(request);
        const items = Array.isArray(body.items) ? (body.items as Array<Record<string, unknown>>) : [];
        const time = nowIso();
        for (const item of items) {
          const actionKey = requiredString(item, 'actionKey');
          const existing = normalizeRow(db.prepare('SELECT * FROM d1_guide_configs WHERE actionKey = ?').get(actionKey) as Record<string, unknown> | undefined);
          if (!existing) return { status: 404, error: 'D1 guide config not found' };
          assertD1GuideItem(actionKey, item);
          db.prepare(
            `UPDATE d1_guide_configs
             SET title = ?, description = ?, targetGroupName = ?, applyUrl = ?, sendToEmployeeName = ?, sendToEmployeeContact = ?,
                 documentTitle = ?, documentUrl = ?, routePath = ?, label = ?, ownerName = ?, enabled = ?, updatedAt = ?, updatedBy = ?
             WHERE actionKey = ?`,
          ).run(
            sqlValue(optionalString(item, 'title', existing.title)),
            sqlValue(optionalString(item, 'description', existing.description)),
            sqlValue(optionalNullableString(item, 'targetGroupName', existing.targetGroupName)),
            sqlValue(optionalNullableString(item, 'applyUrl', existing.applyUrl)),
            sqlValue(optionalNullableString(item, 'sendToEmployeeName', existing.sendToEmployeeName)),
            sqlValue(optionalNullableString(item, 'sendToEmployeeContact', existing.sendToEmployeeContact)),
            sqlValue(optionalNullableString(item, 'documentTitle', existing.documentTitle)),
            sqlValue(optionalNullableString(item, 'documentUrl', existing.documentUrl)),
            sqlValue(optionalNullableString(item, 'routePath', existing.routePath)),
            sqlValue(optionalString(item, 'label', existing.label)),
            sqlValue(optionalString(item, 'ownerName', existing.ownerName)),
            'enabled' in item ? boolToDb(item.enabled) : boolToDb(existing.enabled),
            time,
            adminActor(body),
            actionKey,
          );
        }
        return { data: getD1GuideConfig(db) };
      };

export const updateAnonymousFeedbackConfig: RouteMatch['handler'] = async ({ db, request }) => {
        const body = await readBody(request);
        const time = nowIso();
        const modules = Array.isArray(body.modules) ? (body.modules as Array<Record<string, unknown>>) : [];
        const problemTypes = Array.isArray(body.problemTypes) ? (body.problemTypes as Array<Record<string, unknown>>) : [];
        const expectedActions = Array.isArray(body.expectedActions) ? (body.expectedActions as Array<Record<string, unknown>>) : [];

        for (const module of modules) {
          const id = requiredString(module, 'id');
          const existing = normalizeRow(db.prepare('SELECT * FROM anonymous_feedback_modules WHERE id = ?').get(id) as Record<string, unknown> | undefined);
          if (!existing) return { status: 404, error: 'Anonymous feedback module not found' };
          db.prepare('UPDATE anonymous_feedback_modules SET label = ?, enabled = ?, updatedAt = ?, updatedBy = ? WHERE id = ?').run(
            sqlValue(optionalString(module, 'label', existing.label)),
            'enabled' in module ? boolToDb(module.enabled) : boolToDb(existing.enabled),
            time,
            adminActor(body),
            id,
          );
        }

        for (const problemType of problemTypes) {
          const id = requiredString(problemType, 'id');
          const existing = normalizeRow(
            db.prepare('SELECT * FROM anonymous_feedback_problem_types WHERE id = ?').get(id) as Record<string, unknown> | undefined,
          );
          if (!existing) {
            const moduleId = requiredString(problemType, 'moduleId');
            assertExists(db, 'anonymous_feedback_modules', moduleId, 'module');
            db.prepare(
              `INSERT INTO anonymous_feedback_problem_types
               (id, moduleId, typeKey, label, requiresText, enabled, sortOrder, createdAt, updatedAt, updatedBy)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              id,
              moduleId,
              requiredString(problemType, 'typeKey'),
              requiredString(problemType, 'label'),
              'requiresText' in problemType ? boolToDb(problemType.requiresText) : 0,
              'enabled' in problemType ? boolToDb(problemType.enabled) : 1,
              Number(problemType.sortOrder ?? 99),
              time,
              time,
              adminActor(body),
            );
            continue;
          }
          db.prepare('UPDATE anonymous_feedback_problem_types SET label = ?, requiresText = ?, enabled = ?, updatedAt = ?, updatedBy = ? WHERE id = ?').run(
            sqlValue(optionalString(problemType, 'label', existing.label)),
            'requiresText' in problemType ? boolToDb(problemType.requiresText) : boolToDb(existing.requiresText),
            'enabled' in problemType ? boolToDb(problemType.enabled) : boolToDb(existing.enabled),
            time,
            adminActor(body),
            id,
          );
        }

        for (const action of expectedActions) {
          const id = requiredString(action, 'id');
          const existing = normalizeRow(
            db.prepare('SELECT * FROM anonymous_feedback_expected_actions WHERE id = ?').get(id) as Record<string, unknown> | undefined,
          );
          if (!existing) {
            const moduleId = requiredString(action, 'moduleId');
            assertExists(db, 'anonymous_feedback_modules', moduleId, 'module');
            db.prepare(
              `INSERT INTO anonymous_feedback_expected_actions
               (id, moduleId, actionKey, label, requiresText, enabled, sortOrder, createdAt, updatedAt, updatedBy)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              id,
              moduleId,
              requiredString(action, 'actionKey'),
              requiredString(action, 'label'),
              'requiresText' in action ? boolToDb(action.requiresText) : 0,
              'enabled' in action ? boolToDb(action.enabled) : 1,
              Number(action.sortOrder ?? 99),
              time,
              time,
              adminActor(body),
            );
            continue;
          }
          db.prepare('UPDATE anonymous_feedback_expected_actions SET label = ?, requiresText = ?, enabled = ?, updatedAt = ?, updatedBy = ? WHERE id = ?').run(
            sqlValue(optionalString(action, 'label', existing.label)),
            'requiresText' in action ? boolToDb(action.requiresText) : boolToDb(existing.requiresText),
            'enabled' in action ? boolToDb(action.enabled) : boolToDb(existing.enabled),
            time,
            adminActor(body),
            id,
          );
        }

        return { data: getAnonymousFeedbackConfig(db) };
      };

export const updateAnonymousFeedback: RouteMatch['handler'] = async ({ db, request }, match) => {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = normalizeRow(db.prepare('SELECT * FROM anonymous_feedbacks WHERE id = ?').get(id) as Record<string, unknown> | undefined);
        if (!existing) return { status: 404, error: 'Anonymous feedback not found' };
        const time = nowIso();
        const existingStatus = parseAnonymousFeedbackStatus(existing.status, 'open');
        const nextStatus = parseAnonymousFeedbackStatus(body.status, existingStatus);
        const result = typeof body.result === 'string' && body.result.trim() ? body.result.trim() : String(existing.result ?? '');
        const resolutionNote =
          typeof body.resolutionNote === 'string' && body.resolutionNote.trim()
            ? body.resolutionNote.trim()
            : String(existing.resolutionNote ?? result);
        const handlerName = typeof body.handlerName === 'string' && body.handlerName.trim() ? body.handlerName.trim() : demoAdmin;
        db.prepare(
          `UPDATE anonymous_feedbacks
           SET ownerName = ?, status = ?, result = ?, handlerName = ?, handledAt = ?, resolutionNote = ?, includedInReview = ?, updatedAt = ?, updatedBy = ?
           WHERE id = ?`,
        ).run(
          sqlValue(optionalString(body, 'ownerName', existing.ownerName)),
          sqlValue(nextStatus),
          sqlValue(result),
          sqlValue(handlerName),
          time,
          sqlValue(resolutionNote),
          'includedInReview' in body ? boolToDb(body.includedInReview) : boolToDb(existing.includedInReview),
          time,
          adminActor(body),
          id,
        );
        return { data: normalizeRow(db.prepare('SELECT * FROM anonymous_feedbacks WHERE id = ?').get(id) as Record<string, unknown>) };
      };

export const acceptAdminConfigPatch: RouteMatch['handler'] = async ({ request }) => {
        await readBody(request);
        return { data: { status: 'accepted', note: 'Use specific admin endpoints to update role and permission configuration.' } };
      };
