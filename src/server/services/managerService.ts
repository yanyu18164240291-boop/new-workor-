import type { RouteMatch } from '../routeKit.ts';
import { parseManagerActionStatus } from '../contracts.ts';
import {
  normalizeRow,
  nowIso,
  readBody,
  sqlValue
} from '../routeKit.ts';
import { getWeeklyWithAction } from '../repositories/feedbackRepository.ts';

export const getManagerFeedback: RouteMatch['handler'] = ({ db }, match) => {
        const row = getWeeklyWithAction(db, decodeURIComponent(match[1]));
        return row ? { data: row } : { status: 404, error: 'Weekly feedback not found' };
      };

export const updateManagerFeedbackAction: RouteMatch['handler'] = async ({ db, request }, match) => {
        const weeklyFeedbackId = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const existing = normalizeRow(
          db.prepare('SELECT * FROM manager_feedback_actions WHERE weeklyFeedbackId = ?').get(weeklyFeedbackId) as Record<string, unknown> | undefined,
        );
        if (!existing) return { status: 404, error: 'Manager action not found' };
        const time = nowIso();
        const existingStatus = parseManagerActionStatus(existing.managerActionStatus, 'unread');
        db.prepare(
          'UPDATE manager_feedback_actions SET managerViewed = 1, managerViewedAt = COALESCE(managerViewedAt, ?), managerActionStatus = ?, actionNote = ?, updatedAt = ? WHERE weeklyFeedbackId = ?',
        ).run(
          time,
          sqlValue(parseManagerActionStatus(body.managerActionStatus, existingStatus)),
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
      };
