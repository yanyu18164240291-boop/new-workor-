import type { RouteMatch } from '../routeKit.ts';
import { isPermissionType, parseAnonymousFeedbackStatus } from '../contracts.ts';
import { badRequest, conflict } from '../errors.ts';
import { isAllowedPageRoutePath, isValidExternalUrl } from '../../shared/pageRoutesContract.ts';
import { canEnableKnowledgeDoc, isKnowledgeCategory } from '../../shared/knowledgeContract.ts';
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
import {
  getAdminD1GuideConfig,
  getAdminAnonymousFeedbackConfig,
  getAdminWeeklyFeedbackConfig,
} from '../repositories/configRepository.ts';
import { withAnonymousFeedbackDetail } from '../repositories/feedbackRepository.ts';
import {
  createKnowledgeDoc,
  getKnowledgeDoc,
  listKnowledgeDocs,
  markKnowledgeDocParsed,
  updateKnowledgeDocStatus,
} from '../repositories/knowledgeRepository.ts';
import { count } from '../repositories/metricsRepository.ts';
import { getPermission } from '../repositories/permissionRepository.ts';
import { getFeishuDocumentTitle, getFeishuSessionUser } from './feishuAuthService.ts';
import { createPosition as insertPosition, findPositionByName } from '../repositories/positionRepository.ts';

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
          d1GuideConfig: getAdminD1GuideConfig(db),
          weeklyFeedbackConfig: getAdminWeeklyFeedbackConfig(db),
          anonymousFeedbackConfig: getAdminAnonymousFeedbackConfig(db),
          anonymousFeedbacks: normalizeRows(db.prepare('SELECT * FROM anonymous_feedbacks ORDER BY submittedAt DESC').all() as Array<Record<string, unknown>>).map((row) =>
            withAnonymousFeedbackDetail(db, row),
          ),
        },
      });

export const getAdminD1GuideConfigEndpoint: RouteMatch['handler'] = ({ db }) => ({
        data: getAdminD1GuideConfig(db),
      });

export const listKnowledgeBaseDocs: RouteMatch['handler'] = ({ db }) => ({
        data: listKnowledgeDocs(db),
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

function optionalJsonString(body: Record<string, unknown>, key: string, fallback: unknown): string {
  const value = body[key];
  if (!(key in body)) {
    if (typeof fallback === 'string') return fallback;
    return JSON.stringify(Array.isArray(fallback) ? fallback : []);
  }
  if (!Array.isArray(value)) throw badRequest(`${key} must be a list`);
  return JSON.stringify(value);
}

function d1TaskType(actionKey: string, item: Record<string, unknown>): string {
  if (typeof item.taskType === 'string' && item.taskType.trim()) return item.taskType.trim();
  if (actionKey === 'join_group') return 'join_group';
  if (actionKey === 'employee_guide') return 'employee_guide';
  if (actionKey === 'permission_package') return 'permission_package';
  return 'custom_link';
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

function adminActor(_body: Record<string, unknown>): string {
  return demoAdmin;
}

function inferDocumentTitleFromUrl(documentUrl: string): string {
  try {
    const url = new URL(documentUrl);
    if (url.hostname.includes('feishu.cn') || url.hostname.includes('larksuite.com')) return '飞书员工指南册';
  } catch {
    // Keep the generic fallback below for malformed optional URLs.
  }
  return '员工指南册';
}

function assertAdminUrl(value: string, key: string, allowedSchemes: string[]): void {
  if (!value.trim()) return;
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

function assertExpectedUpdatedAt(body: Record<string, unknown>, existing: Record<string, unknown>, entityLabel: string): void {
  const expected = typeof body.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt.trim() : '';
  if (!expected) throw badRequest(`${entityLabel} expectedUpdatedAt is required`);
  const current = typeof existing.updatedAt === 'string' ? existing.updatedAt : '';
  if (!current || expected !== current) {
    throw conflict(`${entityLabel} update is stale; reload before saving`);
  }
}

function assertRequiredPermissionCanStayEnabled(
  db: Parameters<RouteMatch['handler']>[0]['db'],
  permissionItemId: string,
  permissionType: 'required' | 'optional',
  enabled: boolean,
): void {
  if (enabled || permissionType !== 'required') return;
  const binding = db.prepare('SELECT id FROM role_permission_items WHERE permissionItemId = ? LIMIT 1').get(permissionItemId);
  if (binding) throw badRequest('required permission cannot be disabled while bound to a role package');
  throw badRequest('required permission cannot be disabled');
}

function assertD1GuideItem(actionKey: string, item: Record<string, unknown>): void {
  const enabled = !('enabled' in item) || Boolean(item.enabled);
  const taskType = d1TaskType(actionKey, item);
  requiredString(item, 'title');
  requiredString(item, 'description');
  requiredString(item, 'label');
  requiredString(item, 'ownerName');
  if (enabled && taskType === 'join_group') {
    requiredString(item, 'targetGroupName');
    const hasDirectLink = typeof item.applyUrl === 'string' && item.applyUrl.trim();
    const hasResourceLinks = Array.isArray(item.resourceLinks) && item.resourceLinks.some((link) => typeof link === 'object' && link && typeof (link as Record<string, unknown>).url === 'string' && String((link as Record<string, unknown>).url).trim());
    if (!hasDirectLink && !hasResourceLinks) throw badRequest('join_group applyUrl is required');
  }
  if (enabled && taskType === 'employee_guide') {
    requiredString(item, 'documentTitle');
    requiredString(item, 'documentUrl');
  }
  if (enabled && taskType === 'permission_package') {
    requiredString(item, 'routePath');
  }
  if (taskType === 'join_group') {
    if (typeof item.applyUrl === 'string' && item.applyUrl.trim() && !isValidExternalUrl(item.applyUrl, ['http:', 'https:'])) {
      throw badRequest('join_group applyUrl is invalid');
    }
    if (Array.isArray(item.resourceLinks)) {
      for (const link of item.resourceLinks) {
        if (!link || typeof link !== 'object') throw badRequest('join_group resourceLinks is invalid');
        const url = typeof (link as Record<string, unknown>).url === 'string' ? String((link as Record<string, unknown>).url).trim() : '';
        if (url && !isValidExternalUrl(url, ['http:', 'https:'])) throw badRequest('join_group resource link url is invalid');
      }
    }
  }
  if (taskType === 'employee_guide') {
    if (typeof item.documentUrl === 'string' && item.documentUrl.trim() && !isValidExternalUrl(item.documentUrl, ['http:', 'https:'])) {
      throw badRequest('employee_guide documentUrl is invalid');
    }
  }
  if (taskType === 'permission_package') {
    const routePath = typeof item.routePath === 'string' ? item.routePath.trim() : '';
    if (routePath && !isAllowedPageRoutePath(routePath)) throw badRequest('permission_package routePath must match a known page route');
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

function assertWeeklyChoiceQuestionsHaveEnabledOption(db: Parameters<RouteMatch['handler']>[0]['db'], questions: Array<Record<string, unknown>>): void {
  const choiceQuestions = db.prepare("SELECT id FROM weekly_feedback_questions WHERE inputType IN ('single', 'multi')").all() as Array<{ id: string }>;
  const options = db.prepare('SELECT id, questionId, enabled FROM weekly_feedback_options').all() as Array<{ id: string; questionId: string; enabled: number }>;
  const enabledByQuestion = new Map<string, Map<string, boolean>>();
  for (const option of options) {
    const byOption = enabledByQuestion.get(option.questionId) ?? new Map<string, boolean>();
    byOption.set(option.id, Boolean(option.enabled));
    enabledByQuestion.set(option.questionId, byOption);
  }
  for (const question of questions) {
    if (typeof question.id !== 'string' || !Array.isArray(question.options)) continue;
    const byOption = enabledByQuestion.get(question.id) ?? new Map<string, boolean>();
    (question.options as Array<Record<string, unknown>>).forEach((option, index) => {
      const optionId = typeof option.id === 'string' && option.id.trim() ? option.id : `new-weekly-option-${index}`;
      if (typeof option.label === 'string' && option.label.trim()) {
        byOption.set(optionId, 'enabled' in option ? Boolean(option.enabled) : true);
      } else if (typeof option.id === 'string' && 'enabled' in option) {
        byOption.set(option.id, Boolean(option.enabled));
      }
    });
    enabledByQuestion.set(question.id, byOption);
  }
  for (const question of choiceQuestions) {
    const optionsForQuestion = enabledByQuestion.get(question.id);
    if (!optionsForQuestion || ![...optionsForQuestion.values()].some(Boolean)) {
      throw badRequest('weekly feedback choice question must keep at least one enabled option');
    }
  }
}

function normalizeWeeklyQuestionSortOrders(db: Parameters<RouteMatch['handler']>[0]['db'], prioritizedIds: string[], time: string, actor: string): void {
  const priority = new Map(prioritizedIds.map((id, index) => [id, index]));
  const rows = db.prepare('SELECT id, sortOrder FROM weekly_feedback_questions').all() as Array<{ id: string; sortOrder: number }>;
  const ordered = [...rows].sort((left, right) => {
    const bySort = Number(left.sortOrder) - Number(right.sortOrder);
    if (bySort !== 0) return bySort;
    const leftPriority = priority.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priority.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.id.localeCompare(right.id);
  });
  const update = db.prepare('UPDATE weekly_feedback_questions SET sortOrder = ?, updatedAt = ?, updatedBy = ? WHERE id = ?');
  ordered.forEach((row, index) => {
    update.run(index + 1, time, actor, row.id);
  });
}

function assertWeeklyInputType(value: unknown): 'single' | 'multi' | 'text' {
  if (value === 'single' || value === 'multi' || value === 'text') return value;
  throw badRequest('inputType is invalid');
}

function assertWeeklyOptionBelongsToQuestion(db: Parameters<RouteMatch['handler']>[0]['db'], optionId: string, questionId: string): void {
  const row = db.prepare('SELECT questionId FROM weekly_feedback_options WHERE id = ?').get(optionId) as { questionId: string } | undefined;
  if (!row || row.questionId !== questionId) throw badRequest('weekly feedback option must belong to current question');
}

function assertUniqueAnonymousKey(
  db: Parameters<RouteMatch['handler']>[0]['db'],
  table: 'anonymous_feedback_problem_types' | 'anonymous_feedback_expected_actions',
  keyColumn: 'typeKey' | 'actionKey',
  moduleId: string,
  keyValue: string,
  id: string,
): void {
  const duplicate = db.prepare(`SELECT id FROM ${table} WHERE moduleId = ? AND ${keyColumn} = ? AND id <> ?`).get(moduleId, keyValue, id);
  if (duplicate) throw badRequest(`${keyColumn} must be unique in the same module`);
}

export const createRole: RouteMatch['handler'] = async ({ db, request }) => {
        const body = await readBody(request);
        const name = requiredString(body, 'name');
        if (findPositionByName(db, name)) throw badRequest('role name already exists');
        const time = nowIso();
        const row = {
          id: typeof body.id === 'string' ? body.id : createdId('role'),
          name,
          departmentId: typeof body.departmentId === 'string' && body.departmentId.trim() ? body.departmentId.trim() : 'dept-collaboration-office',
          department: requiredString(body, 'department'),
          description: requiredString(body, 'description'),
          enabled: 'enabled' in body ? boolToDb(body.enabled) : 1,
          createdAt: time,
          updatedAt: time,
          updatedBy: adminActor(body),
        };
        db.prepare('INSERT INTO roles (id, name, departmentId, department, description, enabled, createdAt, updatedAt, updatedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          row.id,
          row.name,
          row.departmentId,
          row.department,
          row.description,
          row.enabled,
          row.createdAt,
          row.updatedAt,
          row.updatedBy,
        );
        return { status: 201, data: normalizeRow(row) };
      };

export const createPosition: RouteMatch['handler'] = async ({ db, request }) => {
        const body = await readBody(request);
        const name = requiredString(body, 'name');
        if (findPositionByName(db, name)) throw badRequest('position name already exists');
        const departmentId = requiredString(body, 'departmentId');
        const department = requiredString(body, 'department');
        const description = requiredString(body, 'description');
        return {
          status: 201,
          data: insertPosition(db, {
            name,
            departmentId,
            department,
            description,
            enabled: 'enabled' in body ? Boolean(body.enabled) : true,
            updatedBy: adminActor(body),
          }),
        };
      };

export const updateRole: RouteMatch['handler'] = async ({ db, request }, match) => {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = normalizeRow(db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as Record<string, unknown> | undefined);
        if (!existing) return { status: 404, error: 'Role not found' };
        const name = optionalString(body, 'name', existing.name);
        const duplicate = findPositionByName(db, name);
        if (duplicate && duplicate.id !== id) throw badRequest('role name already exists');
        const time = nowIso();
        const enabled = 'enabled' in body ? boolToDb(body.enabled) : boolToDb(existing.enabled);
        db.prepare('UPDATE roles SET name = ?, department = ?, description = ?, enabled = ?, updatedAt = ?, updatedBy = ? WHERE id = ?').run(
          sqlValue(name),
          sqlValue(optionalString(body, 'department', existing.department)),
          sqlValue(optionalString(body, 'description', existing.description)),
          enabled,
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
          ownerType: typeof body.ownerType === 'string' && body.ownerType.trim() ? body.ownerType.trim() : 'department',
          ownerName: requiredString(body, 'ownerName'),
          ownerContact: requiredString(body, 'ownerContact'),
          applyEntryName: requiredString(body, 'applyEntryName'),
          applyUrl: requiredString(body, 'applyUrl'),
          reasonTemplate: requiredString(body, 'reasonTemplate'),
          approverName: requiredString(body, 'approverName'),
          commonWaitingReasons: parseCommonWaitingReasons(body.commonWaitingReasons, []),
          enabled: 'enabled' in body ? boolToDb(body.enabled) : 1,
          createdAt: time,
          updatedAt: time,
          updatedBy: adminActor(body),
        };
        assertAdminUrl(row.applyUrl, 'applyUrl', []);
        assertRequiredPermissionCanStayEnabled(db, row.id, row.permissionType, Boolean(row.enabled));
        db.prepare(
          `INSERT INTO permission_items
           (id, name, category, permissionType, sensitive, ownerType, ownerName, ownerContact, applyEntryName, applyUrl, reasonTemplate, approverName, commonWaitingReasons, enabled, createdAt, updatedAt, updatedBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          row.id,
          row.name,
          row.category,
          row.permissionType,
          row.sensitive,
          row.ownerType,
          row.ownerName,
          row.ownerContact,
          row.applyEntryName,
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
        const category = requiredString(body, 'category');
        if (!isKnowledgeCategory(category)) throw badRequest('category is invalid');
        const applicableRoleId = requiredString(body, 'applicableRoleId');
        const role = normalizeRow(db.prepare('SELECT * FROM roles WHERE id = ?').get(applicableRoleId) as Record<string, unknown> | undefined);
        if (!role) throw badRequest('applicableRoleId is invalid');
        const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl : 'mock-drive://manual-entry';
        assertAdminUrl(sourceUrl, 'sourceUrl', ['mock-drive://']);
        const filePath = typeof body.filePath === 'string' && body.filePath.trim() ? body.filePath.trim() : 'mock-file://selected-admin-doc.pdf';
        if (!filePath.startsWith('mock-file://')) throw badRequest('filePath is invalid');
        const row = createKnowledgeDoc(db, {
          id: typeof body.id === 'string' ? body.id : createdId('kb'),
          title: requiredString(body, 'title'),
          category,
          applicableRoleId,
          applicableRole:
            typeof body.applicableRole === 'string' && body.applicableRole.trim() ? body.applicableRole.trim() : String(role.name ?? ''),
          applicableStage: requiredString(body, 'applicableStage'),
          sourceUrl,
          fileSize: Number(body.fileSize ?? 0),
          fileHash: typeof body.fileHash === 'string' && body.fileHash.trim() ? body.fileHash.trim() : 'mock-md5-pending',
          filePath,
          ownerName: requiredString(body, 'ownerName'),
          updatedBy: adminActor(body),
        });
        return { status: 201, data: row };
      };

export const triggerMockKnowledgeParse: RouteMatch['handler'] = async ({ db, request }, match) => {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = getKnowledgeDoc(db, id);
        if (!existing) return { status: 404, error: 'Knowledge doc not found' };
        return { data: markKnowledgeDocParsed(db, id, adminActor(body)) };
      };

export const updateKnowledgeBaseDocStatus: RouteMatch['handler'] = async ({ db, request }, match) => {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = getKnowledgeDoc(db, id);
        if (!existing) return { status: 404, error: 'Knowledge doc not found' };
        const status = requiredString(body, 'status');
        if (!['disabled', 'enabled', 'offline'].includes(status)) throw badRequest('status is invalid');
        if (status === 'enabled' && !canEnableKnowledgeDoc(String(existing.parseStatus), String(existing.vectorStatus))) {
          throw badRequest('knowledge doc must be parsed and vector ready before enabling');
        }
        return { data: updateKnowledgeDocStatus(db, id, status, adminActor(body)) };
      };

export const createWeeklyFeedbackQuestion: RouteMatch['handler'] = async ({ db, request }) => {
        const body = await readBody(request);
        const inputType = assertWeeklyInputType(body.inputType);
        const options = Array.isArray(body.options) ? (body.options as Array<Record<string, unknown>>) : [];
        if (inputType !== 'text' && !options.some((option) => !('enabled' in option) || Boolean(option.enabled))) {
          throw badRequest('weekly feedback choice question must keep at least one enabled option');
        }
        const time = nowIso();
        const questionId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : createdId('weekly-question');
        const sortOrder = Number(body.sortOrder ?? ((db.prepare('SELECT COALESCE(MAX(sortOrder), 0) + 1 AS nextSort FROM weekly_feedback_questions').get() as { nextSort: number }).nextSort));
        db.prepare(
          `INSERT INTO weekly_feedback_questions
           (id, questionKey, title, description, inputType, required, maxLength, enabled, sortOrder, createdAt, updatedAt, updatedBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          questionId,
          typeof body.questionKey === 'string' && body.questionKey.trim() ? body.questionKey.trim() : questionId,
          requiredString(body, 'title'),
          sqlValue(optionalNullableString(body, 'description', null)),
          inputType,
          'required' in body ? boolToDb(body.required) : 0,
          inputType === 'text' ? Number(body.maxLength ?? 500) : null,
          'enabled' in body ? boolToDb(body.enabled) : 1,
          sortOrder,
          time,
          time,
          adminActor(body),
        );
        if (inputType !== 'text') {
          options.forEach((option, index) => {
            const optionId = typeof option.id === 'string' && option.id.trim() ? option.id.trim() : createdId('weekly-option');
            db.prepare(
              `INSERT INTO weekly_feedback_options
               (id, questionId, optionKey, label, enabled, sortOrder, createdAt, updatedAt, updatedBy)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              optionId,
              questionId,
              typeof option.optionKey === 'string' && option.optionKey.trim() ? option.optionKey.trim() : optionId,
              requiredString(option, 'label'),
              'enabled' in option ? boolToDb(option.enabled) : 1,
              Number(option.sortOrder ?? index + 1),
              time,
              time,
              adminActor(body),
            );
          });
        }
        return { status: 201, data: getAdminWeeklyFeedbackConfig(db) };
      };

export const updatePermissionItem: RouteMatch['handler'] = async ({ db, request }, match) => {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = getPermission(db, id);
        if (!existing) return { status: 404, error: 'Permission item not found' };
        assertExpectedUpdatedAt(body, existing, 'permission item');
        const time = nowIso();
        const permissionType = assertPermissionType(body.permissionType, existing.permissionType);
        const applyUrl = typeof body.applyUrl === 'string' ? body.applyUrl.trim() : String(existing.applyUrl ?? '');
        const enabled = 'enabled' in body ? Boolean(body.enabled) : Boolean(existing.enabled);
        assertAdminUrl(applyUrl, 'applyUrl', []);
        assertRequiredPermissionCanStayEnabled(db, id, permissionType, enabled);
        db.prepare(
          `UPDATE permission_items
           SET name = ?, category = ?, permissionType = ?, sensitive = ?, ownerType = ?, ownerName = ?, ownerContact = ?, applyEntryName = ?, applyUrl = ?, reasonTemplate = ?, approverName = ?, commonWaitingReasons = ?, enabled = ?, updatedAt = ?, updatedBy = ?
           WHERE id = ?`,
        ).run(
          sqlValue(optionalString(body, 'name', existing.name)),
          sqlValue(optionalString(body, 'category', existing.category)),
          permissionType,
          'sensitive' in body ? boolToDb(body.sensitive) : boolToDb(existing.sensitive),
          sqlValue(typeof body.ownerType === 'string' && body.ownerType.trim() ? body.ownerType.trim() : existing.ownerType ?? 'department'),
          sqlValue(typeof body.ownerName === 'string' ? body.ownerName : existing.ownerName),
          sqlValue(typeof body.ownerContact === 'string' ? body.ownerContact : existing.ownerContact),
          sqlValue(optionalString(body, 'applyEntryName', existing.applyEntryName ?? existing.name)),
          sqlValue(applyUrl),
          sqlValue(typeof body.reasonTemplate === 'string' ? body.reasonTemplate : existing.reasonTemplate),
          sqlValue(typeof body.approverName === 'string' ? body.approverName : existing.approverName),
          parseCommonWaitingReasons(body.commonWaitingReasons, existing.commonWaitingReasons),
          boolToDb(enabled),
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
        const actor = adminActor(body);
        const sortOrderUpdates: string[] = [];
        assertWeeklyConfigStillHasQuestion(db, questions);
        assertWeeklyChoiceQuestionsHaveEnabledOption(db, questions);
        for (const question of questions) {
          const id = requiredString(question, 'id');
          assertExists(db, 'weekly_feedback_questions', id, 'questionId');
          if ('sortOrder' in question) {
            const sortOrder = Number(question.sortOrder);
            if (!Number.isFinite(sortOrder) || sortOrder <= 0) throw badRequest('sortOrder is invalid');
            db.prepare('UPDATE weekly_feedback_questions SET sortOrder = ?, updatedAt = ?, updatedBy = ? WHERE id = ?').run(
              sortOrder,
              time,
              actor,
              id,
            );
            sortOrderUpdates.push(id);
          }
          if ('title' in question) {
            const title = requiredString(question, 'title');
            db.prepare('UPDATE weekly_feedback_questions SET title = ?, description = ?, required = ?, maxLength = ?, enabled = ?, updatedAt = ?, updatedBy = ? WHERE id = ?').run(
              title,
              'description' in question ? optionalNullableString(question, 'description', null) : sqlValue((db.prepare('SELECT description FROM weekly_feedback_questions WHERE id = ?').get(id) as { description?: string | null }).description),
              'required' in question ? boolToDb(question.required) : sqlValue((db.prepare('SELECT required FROM weekly_feedback_questions WHERE id = ?').get(id) as { required: number }).required),
              'maxLength' in question ? (question.maxLength === null ? null : Number(question.maxLength)) : sqlValue((db.prepare('SELECT maxLength FROM weekly_feedback_questions WHERE id = ?').get(id) as { maxLength?: number | null }).maxLength),
              'enabled' in question ? boolToDb(question.enabled) : sqlValue((db.prepare('SELECT enabled FROM weekly_feedback_questions WHERE id = ?').get(id) as { enabled: number }).enabled),
              time,
              actor,
              id,
            );
          }
          if (Array.isArray(question.options)) {
            for (const option of question.options as Array<Record<string, unknown>>) {
              if (typeof option.label === 'string' && option.label.trim()) {
                const optionId = typeof option.id === 'string' && option.id.trim() ? option.id.trim() : '';
                if (optionId) {
                  assertExists(db, 'weekly_feedback_options', optionId, 'optionId');
                  assertWeeklyOptionBelongsToQuestion(db, optionId, id);
                  db.prepare('UPDATE weekly_feedback_options SET label = ?, enabled = ?, sortOrder = ?, updatedAt = ?, updatedBy = ? WHERE id = ? AND questionId = ?').run(
                    requiredString(option, 'label'),
                    'enabled' in option ? boolToDb(option.enabled) : sqlValue((db.prepare('SELECT enabled FROM weekly_feedback_options WHERE id = ?').get(optionId) as { enabled: number }).enabled),
                    'sortOrder' in option ? Number(option.sortOrder) : sqlValue((db.prepare('SELECT sortOrder FROM weekly_feedback_options WHERE id = ?').get(optionId) as { sortOrder: number }).sortOrder),
                    time,
                    actor,
                    optionId,
                    id,
                  );
                } else {
                  const newOptionId = createdId('weekly-option');
                  db.prepare(
                    `INSERT INTO weekly_feedback_options
                     (id, questionId, optionKey, label, enabled, sortOrder, createdAt, updatedAt, updatedBy)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  ).run(
                    newOptionId,
                    id,
                    typeof option.optionKey === 'string' && option.optionKey.trim() ? option.optionKey.trim() : newOptionId,
                    requiredString(option, 'label'),
                    'enabled' in option ? boolToDb(option.enabled) : 1,
                    'sortOrder' in option ? Number(option.sortOrder) : 99,
                    time,
                    time,
                    actor,
                  );
                }
              }
            }
          }
        }
        if (sortOrderUpdates.length > 0) {
          normalizeWeeklyQuestionSortOrders(db, sortOrderUpdates, time, actor);
        }
        return { data: getAdminWeeklyFeedbackConfig(db) };
      };

export const updateD1GuideConfig: RouteMatch['handler'] = async (context) => {
        const { db, request } = context;
        const body = await readBody(request);
        const items = Array.isArray(body.items) ? (body.items as Array<Record<string, unknown>>) : [];
        const actor = getFeishuSessionUser(context)?.name ?? adminActor(body);
        const time = nowIso();
        for (const rawItem of items) {
          const item = { ...rawItem };
          const actionKey = requiredString(item, 'actionKey');
          const taskType = d1TaskType(actionKey, item);
          if (taskType === 'employee_guide' && typeof item.documentUrl === 'string' && item.documentUrl.trim() && !optionalNullableString(item, 'documentTitle', null)) {
            item.documentTitle = (await getFeishuDocumentTitle(item.documentUrl).catch(() => undefined)) ?? inferDocumentTitleFromUrl(item.documentUrl);
          }
          const existing = normalizeRow(db.prepare('SELECT * FROM d1_guide_configs WHERE actionKey = ?').get(actionKey) as Record<string, unknown> | undefined);
          const merged = existing ? { ...existing, ...item } : item;
          assertD1GuideItem(actionKey, merged);
          const sortOrder =
            'sortOrder' in item && Number.isFinite(Number(item.sortOrder))
              ? Number(item.sortOrder)
              : existing
                ? Number(existing.sortOrder ?? 99)
                : Number((db.prepare('SELECT COALESCE(MAX(sortOrder), 0) + 1 AS nextSortOrder FROM d1_guide_configs').get() as { nextSortOrder: number }).nextSortOrder);
          if (!existing) {
            db.prepare(
              `INSERT INTO d1_guide_configs
               (actionKey, taskType, organizationPath, departmentId, departmentName, roleId, roleName, title, description, targetGroupName, applyUrl, sendToEmployeeName,
                sendToEmployeeContact, documentTitle, documentUrl, resourceLinks, routePath, label, ownerName, enabled, sortOrder, createdAt, updatedAt, updatedBy)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              actionKey,
              d1TaskType(actionKey, item),
              sqlValue(optionalString(item, 'organizationPath', '海底捞国际控股有限公司-集团总部-中台业务-技术管理中心-信息技术部-运维与网安组-安全与合规组')),
              sqlValue(optionalString(item, 'departmentId', 'dept-collaboration-office')),
              sqlValue(optionalString(item, 'departmentName', '协同办公部门')),
              sqlValue(optionalString(item, 'roleId', 'role-product-intern')),
              sqlValue(optionalString(item, 'roleName', '协同办公产品实习生')),
              sqlValue(optionalString(item, 'title', '新增 D1 引导任务')),
              sqlValue(optionalString(item, 'description', '请补充任务说明。')),
              sqlValue(optionalNullableString(item, 'targetGroupName', null)),
              sqlValue(optionalNullableString(item, 'applyUrl', null)),
              sqlValue(optionalNullableString(item, 'sendToEmployeeName', null)),
              sqlValue(optionalNullableString(item, 'sendToEmployeeContact', null)),
              sqlValue(optionalNullableString(item, 'documentTitle', null)),
              sqlValue(optionalNullableString(item, 'documentUrl', null)),
              optionalJsonString(item, 'resourceLinks', []),
              sqlValue(optionalNullableString(item, 'routePath', null)),
              sqlValue(optionalString(item, 'label', '打开')),
              sqlValue(optionalString(item, 'ownerName', '后台管理员')),
              'enabled' in item ? boolToDb(item.enabled) : 1,
              sortOrder,
              time,
              time,
              actor,
            );
          } else {
            db.prepare(
              `UPDATE d1_guide_configs
               SET taskType = ?, organizationPath = ?, departmentId = ?, departmentName = ?, roleId = ?, roleName = ?,
                   title = ?, description = ?, targetGroupName = ?, applyUrl = ?, sendToEmployeeName = ?, sendToEmployeeContact = ?,
                   documentTitle = ?, documentUrl = ?, resourceLinks = ?, routePath = ?, label = ?, ownerName = ?, enabled = ?, sortOrder = ?, updatedAt = ?, updatedBy = ?
               WHERE actionKey = ?`,
            ).run(
              d1TaskType(actionKey, { ...existing, ...item }),
              sqlValue(optionalString(item, 'organizationPath', existing.organizationPath)),
              sqlValue(optionalString(item, 'departmentId', existing.departmentId)),
              sqlValue(optionalString(item, 'departmentName', existing.departmentName)),
              sqlValue(optionalString(item, 'roleId', existing.roleId)),
              sqlValue(optionalString(item, 'roleName', existing.roleName)),
              sqlValue(optionalString(item, 'title', existing.title)),
              sqlValue(optionalString(item, 'description', existing.description)),
              sqlValue(optionalNullableString(item, 'targetGroupName', existing.targetGroupName)),
              sqlValue(optionalNullableString(item, 'applyUrl', existing.applyUrl)),
              sqlValue(optionalNullableString(item, 'sendToEmployeeName', existing.sendToEmployeeName)),
              sqlValue(optionalNullableString(item, 'sendToEmployeeContact', existing.sendToEmployeeContact)),
              sqlValue(optionalNullableString(item, 'documentTitle', existing.documentTitle)),
              sqlValue(optionalNullableString(item, 'documentUrl', existing.documentUrl)),
              optionalJsonString(item, 'resourceLinks', existing.resourceLinks),
              sqlValue(optionalNullableString(item, 'routePath', existing.routePath)),
              sqlValue(optionalString(item, 'label', existing.label)),
              sqlValue(optionalString(item, 'ownerName', existing.ownerName)),
              'enabled' in item ? boolToDb(item.enabled) : boolToDb(existing.enabled),
              sortOrder,
              time,
              actor,
              actionKey,
            );
          }
        }
        return { data: getAdminD1GuideConfig(db) };
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
            const typeKey = requiredString(problemType, 'typeKey');
            assertUniqueAnonymousKey(db, 'anonymous_feedback_problem_types', 'typeKey', moduleId, typeKey, id);
            db.prepare(
              `INSERT INTO anonymous_feedback_problem_types
               (id, moduleId, typeKey, label, requiresText, enabled, sortOrder, createdAt, updatedAt, updatedBy)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              id,
              moduleId,
              typeKey,
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
          const moduleId = typeof problemType.moduleId === 'string' && problemType.moduleId.trim() ? problemType.moduleId.trim() : String(existing.moduleId);
          const typeKey = typeof problemType.typeKey === 'string' && problemType.typeKey.trim() ? problemType.typeKey.trim() : String(existing.typeKey);
          assertExists(db, 'anonymous_feedback_modules', moduleId, 'module');
          assertUniqueAnonymousKey(db, 'anonymous_feedback_problem_types', 'typeKey', moduleId, typeKey, id);
          db.prepare(
            'UPDATE anonymous_feedback_problem_types SET moduleId = ?, typeKey = ?, label = ?, requiresText = ?, enabled = ?, sortOrder = ?, updatedAt = ?, updatedBy = ? WHERE id = ?',
          ).run(
            moduleId,
            typeKey,
            sqlValue(optionalString(problemType, 'label', existing.label)),
            'requiresText' in problemType ? boolToDb(problemType.requiresText) : boolToDb(existing.requiresText),
            'enabled' in problemType ? boolToDb(problemType.enabled) : boolToDb(existing.enabled),
            'sortOrder' in problemType ? Number(problemType.sortOrder) : Number(existing.sortOrder ?? 99),
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
            const actionKey = requiredString(action, 'actionKey');
            assertUniqueAnonymousKey(db, 'anonymous_feedback_expected_actions', 'actionKey', moduleId, actionKey, id);
            db.prepare(
              `INSERT INTO anonymous_feedback_expected_actions
               (id, moduleId, actionKey, label, requiresText, enabled, sortOrder, createdAt, updatedAt, updatedBy)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              id,
              moduleId,
              actionKey,
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
          const moduleId = typeof action.moduleId === 'string' && action.moduleId.trim() ? action.moduleId.trim() : String(existing.moduleId);
          const actionKey = typeof action.actionKey === 'string' && action.actionKey.trim() ? action.actionKey.trim() : String(existing.actionKey);
          assertExists(db, 'anonymous_feedback_modules', moduleId, 'module');
          assertUniqueAnonymousKey(db, 'anonymous_feedback_expected_actions', 'actionKey', moduleId, actionKey, id);
          db.prepare(
            'UPDATE anonymous_feedback_expected_actions SET moduleId = ?, actionKey = ?, label = ?, requiresText = ?, enabled = ?, sortOrder = ?, updatedAt = ?, updatedBy = ? WHERE id = ?',
          ).run(
            moduleId,
            actionKey,
            sqlValue(optionalString(action, 'label', existing.label)),
            'requiresText' in action ? boolToDb(action.requiresText) : boolToDb(existing.requiresText),
            'enabled' in action ? boolToDb(action.enabled) : boolToDb(existing.enabled),
            'sortOrder' in action ? Number(action.sortOrder) : Number(existing.sortOrder ?? 99),
            time,
            adminActor(body),
            id,
          );
        }

        return { data: getAdminAnonymousFeedbackConfig(db) };
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
