import type { RouteMatch } from '../routeKit.ts';
import {
  boolToDb,
  count,
  createdId,
  getAnonymousFeedbackConfig,
  getD1GuideConfig,
  getPermission,
  getWeeklyFeedbackConfig,
  normalizeRow,
  normalizeRows,
  nowIso,
  readBody,
  requiredString,
  sqlValue,
  withAnonymousFeedbackDetail
} from '../routeKit.ts';

export const adminRoutes: Record<string, RouteMatch[]> = {
  GET: [
    {
      pattern: /^\/api\/admin\/anonymous-feedbacks$/,
      handler: ({ db }) => ({
        data: normalizeRows(db.prepare('SELECT * FROM anonymous_feedbacks ORDER BY submittedAt DESC').all() as Array<Record<string, unknown>>).map((row) =>
          withAnonymousFeedbackDetail(db, row),
        ),
      }),
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
    }
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
    }
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
      pattern: /^\/api\/admin\/config$/,
      handler: async ({ request }) => {
        await readBody(request);
        return { data: { status: 'accepted', note: 'Use specific admin endpoints to update role and permission configuration.' } };
      },
    }
  ],
};
