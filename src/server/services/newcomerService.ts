import type { RouteMatch } from '../routeKit.ts';
import {
  isSubmittedPermissionStatus,
  parseFollowUpStatus,
  parsePermissionProgressStatus,
  parseTaskStatus,
  parseWeeklyAnswerInputs
} from '../contracts.ts';
import {
  addHours,
  boolToDb,
  createdId,
  normalizeRow,
  normalizeRows,
  nowIso,
  readBody,
  requiredString,
  sqlValue,
  stringArray,
  validIsoNow
} from '../routeKit.ts';
import { getAnonymousFeedbackConfig, getD1GuideConfig, getWeeklyFeedbackConfig } from '../repositories/configRepository.ts';
import {
  deriveWeeklyLegacyFields,
  resolveStructuredAnonymousFeedback,
  saveWeeklyAnswers,
  validateWeeklyAnswers,
  withAnonymousFeedbackDetail
} from '../repositories/feedbackRepository.ts';
import { getPermission } from '../repositories/permissionRepository.ts';

export const listRoles: RouteMatch['handler'] = ({ db }) => ({
        data: normalizeRows(db.prepare('SELECT * FROM roles WHERE enabled = 1 ORDER BY createdAt').all() as Array<Record<string, unknown>>),
      });

export const getRolePermissionPackage: RouteMatch['handler'] = ({ db }, match) => {
        const roleId = decodeURIComponent(match[1]);
        const role = normalizeRow(db.prepare('SELECT * FROM roles WHERE id = ? AND enabled = 1').get(roleId) as Record<string, unknown> | undefined);
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
      };

export const getPermissionItem: RouteMatch['handler'] = ({ db }, match) => {
        const item = getPermission(db, decodeURIComponent(match[1]));
        return item ? { data: item } : { status: 404, error: 'Permission item not found' };
      };

export const getPermissionRoute: RouteMatch['handler'] = ({ db }, match) => {
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
      };

export const getNewcomer: RouteMatch['handler'] = ({ db }, match) => {
        const newcomer = normalizeRow(db.prepare('SELECT * FROM newcomers WHERE id = ?').get(decodeURIComponent(match[1])) as Record<string, unknown> | undefined);
        if (!newcomer) return { status: 404, error: 'Newcomer not found' };
        const taskStates = normalizeRows(
          db.prepare('SELECT * FROM newcomer_task_states WHERE newcomerId = ? ORDER BY createdAt').all(sqlValue(newcomer.id)) as Array<Record<string, unknown>>,
        );
        return { data: { ...newcomer, taskStates } };
      };

export const listPermissionProgress: RouteMatch['handler'] = ({ db }, match) => ({
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
      });

export const listFollowUpTasks: RouteMatch['handler'] = ({ db }, match) => ({
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
      });

export const listFollowUpMessageCards: RouteMatch['handler'] = ({ db }, match) => ({
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
      });

export const loadD1GuideConfig: RouteMatch['handler'] = ({ db, request }) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  return { data: getD1GuideConfig(db, url.searchParams.get('roleId')) };
};

export const loadWeeklyFeedbackConfig: RouteMatch['handler'] = ({ db }) => ({ data: getWeeklyFeedbackConfig(db) });

export const loadAnonymousFeedbackConfig: RouteMatch['handler'] = ({ db }) => ({ data: getAnonymousFeedbackConfig(db) });

export const getFollowUpTask: RouteMatch['handler'] = ({ db }, match) => {
        const row = normalizeRow(db.prepare('SELECT * FROM follow_up_tasks WHERE id = ?').get(decodeURIComponent(match[1])) as Record<string, unknown> | undefined);
        return row ? { data: row } : { status: 404, error: 'Follow-up task not found' };
      };

export const getNewcomerWeeklyFeedback: RouteMatch['handler'] = ({ db }, match) => {
        const row = normalizeRow(
          db
            .prepare('SELECT * FROM weekly_feedbacks WHERE newcomerId = ? ORDER BY submittedAt DESC LIMIT 1')
            .get(decodeURIComponent(match[1])) as Record<string, unknown> | undefined,
        );
        return row ? { data: row } : { status: 404, error: 'Weekly feedback not found' };
      };

export const createPermissionProgress: RouteMatch['handler'] = async ({ db, request }, match) => {
        const newcomerId = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const permissionItemId = requiredString(body, 'permissionItemId');
        const status = parsePermissionProgressStatus(body.status);
        const permission = getPermission(db, permissionItemId);
        if (!permission) return { status: 404, error: 'Permission item not found' };

        const existing = db.prepare('SELECT * FROM permission_progress WHERE newcomerId = ? AND permissionItemId = ?').get(newcomerId, permissionItemId) as
          | Record<string, unknown>
          | undefined;
        const time = nowIso();
        const progressId = existing?.id ? String(existing.id) : createdId('progress');
        const submittedAt = isSubmittedPermissionStatus(status) ? time : null;
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
        if (isSubmittedPermissionStatus(status) && !followUp) {
          const followUpId = createdId('follow-up');
          const submitted = submittedAt ?? time;
          db.prepare(
            'INSERT INTO follow_up_tasks (id, newcomerId, permissionProgressId, submittedAt, followUpAt, status, ownerName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          ).run(followUpId, newcomerId, progressId, submitted, addHours(submitted, 4), 'pending', sqlValue(permission.ownerName), time, time);
          followUp = db.prepare('SELECT * FROM follow_up_tasks WHERE id = ?').get(followUpId) as Record<string, unknown>;
        }
        const progress = normalizeRow(db.prepare('SELECT * FROM permission_progress WHERE id = ?').get(progressId) as Record<string, unknown>);
        return { status: existing ? 200 : 201, data: { progress, followUpTask: normalizeRow(followUp) } };
      };

export const createAnonymousFeedback: RouteMatch['handler'] = async ({ db, request }) => {
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
      };

export const createWeeklyFeedback: RouteMatch['handler'] = async ({ db, request }) => {
        const body = await readBody(request);
        const newcomerId = requiredString(body, 'newcomerId');
        const structuredAnswers = parseWeeklyAnswerInputs(body.answers);
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
          workSummary: derived ? derived.workSummary : typeof body.workSummary === 'string' ? body.workSummary.trim() : '',
          visibleToManager: true,
          lifecycle: 'submitted',
          submittedAt,
        };
        db.prepare(
          `INSERT INTO weekly_feedbacks
           (id, newcomerId, overallFeeling, blockers, supportNeeded, message, workSummary, visibleToManager, lifecycle, submittedAt, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          row.id,
          row.newcomerId,
          row.overallFeeling,
          row.blockers,
          row.supportNeeded,
          row.message,
          row.workSummary,
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
      };

export const dispatchFollowUpMessageCards: RouteMatch['handler'] = async ({ db, request }) => {
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
      };

export const updateNewcomerTaskState: RouteMatch['handler'] = async ({ db, request }, match) => {
        const newcomerId = decodeURIComponent(match[1]);
        const taskKey = decodeURIComponent(match[2]);
        const body = await readBody(request);
        const status = parseTaskStatus(body.status);
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
      };

export const updateNewcomer: RouteMatch['handler'] = async ({ db, request }, match) => {
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
      };

export const updateFollowUpTask: RouteMatch['handler'] = async ({ db, request }, match) => {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = normalizeRow(db.prepare('SELECT * FROM follow_up_tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined);
        if (!existing) return { status: 404, error: 'Follow-up task not found' };
        const time = nowIso();
        const existingStatus = parseFollowUpStatus(existing.status);
        db.prepare('UPDATE follow_up_tasks SET status = ?, updatedAt = ? WHERE id = ?').run(
          sqlValue(parseFollowUpStatus(body.status, existingStatus)),
          time,
          id,
        );
        return { data: normalizeRow(db.prepare('SELECT * FROM follow_up_tasks WHERE id = ?').get(id) as Record<string, unknown>) };
      };

export const syncPermissionApplications: RouteMatch['handler'] = async ({ db, request }, match) => {
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
      };
