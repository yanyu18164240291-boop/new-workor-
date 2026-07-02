import type { RouteMatch } from '../routeKit.ts';
import { parseManagerActionStatus } from '../contracts.ts';
import {
  normalizeRow,
  nowIso,
  readBody,
  sqlValue
} from '../routeKit.ts';
import { getWeeklyWithAction } from '../repositories/feedbackRepository.ts';
import {
  findLatestManagerWeeklyForNewcomer,
  findManagerNewcomerById,
  findManagerWeeklyWorkSummary,
  findManagerWeeklyById,
  listManagerOverviewRows,
  listManagerRoleStats,
  listManagerTaskStates,
} from '../repositories/managerRepository.ts';

const demoManagerNameByActor: Record<string, string> = {
  'demo-manager': '刘长省',
  'demo-other-manager': '其他经理',
};

type RequestWithHeaders = Parameters<RouteMatch['handler']>[0]['request'];

function currentManagerName(request: RequestWithHeaders): string {
        const actor = request.headers['x-haina-actor'];
        const key = Array.isArray(actor) ? actor[0] : actor;
        return demoManagerNameByActor[key ?? ''] ?? '刘长省';
      }

function pageNumber(value: string | null, fallback: number, max: number): number {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 0) return fallback;
        return Math.min(parsed, max);
      }

function onboardingStatus(row: Record<string, unknown>): 'weekly_feedback_pending_review' | 'permission_pending_follow_up' | 'on_track' {
        if (Number(row.pendingPermissionCount) > 0 || Number(row.pendingFollowUpCount) > 0) return 'permission_pending_follow_up';
        if (row.latestWeeklyFeedbackId && ['unread', 'pending_follow_up'].includes(String(row.latestManagerActionStatus ?? 'unread'))) {
          return 'weekly_feedback_pending_review';
        }
        return 'on_track';
      }

function includeReason(_row: Record<string, unknown>): 'first_week' {
        return 'first_week';
      }

function primaryAction(row: Record<string, unknown>) {
        if (row.latestWeeklyFeedbackId && ['unread', 'pending_follow_up'].includes(String(row.latestManagerActionStatus ?? 'unread'))) {
          return { type: 'view_feedback', label: '查看反馈', targetPath: `/manager/feedback/${row.latestWeeklyFeedbackId}` };
        }
        if (Number(row.pendingFollowUpCount) > 0 || Number(row.pendingPermissionCount) > 0) {
          return { type: 'remind_mentor', label: '提醒导师' };
        }
        return { type: 'view_detail', label: '查看详情', targetPath: `/manager/newcomer/${row.id}` };
      }

function feedbackActionLabel(status?: string) {
        if (status === 'pending_follow_up') return '待沟通';
        if (status === 'viewed') return '已查看';
        if (status === 'followed_up') return '已安排沟通';
        if (status === 'closed') return '已关闭';
        return '已提交反馈';
      }

function calculateOnboardingStage(joinedAt: unknown, fallback: unknown): string {
        if (typeof joinedAt !== 'string' || joinedAt.trim() === '') return String(fallback ?? 'D1');
        const joinedDate = new Date(joinedAt);
        if (Number.isNaN(joinedDate.getTime())) return String(fallback ?? 'D1');
        const now = new Date();
        const joinedDay = new Date(joinedDate.getFullYear(), joinedDate.getMonth(), joinedDate.getDate()).getTime();
        const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const elapsedDays = Math.floor((currentDay - joinedDay) / 86_400_000) + 1;
        return `D${Math.max(elapsedDays, 1)}`;
      }

function isWeeklyArrivalStage(stage: string): boolean {
        const day = Number(stage.replace(/^D/, ''));
        return Number.isInteger(day) && day >= 1 && day <= 7;
      }

function splitWeeklyText(value: unknown): string[] {
        return String(value ?? '')
          .split('、')
          .map((item) => item.trim())
          .filter(Boolean);
      }

function buildManagerNewcomerDetail(db: Parameters<RouteMatch['handler']>[0]['db'], managerName: string, newcomerId: string) {
        const newcomer = findManagerNewcomerById(db, { managerName, newcomerId });
        if (!newcomer) return null;

        const taskStates = listManagerTaskStates(db, newcomerId);
        const weekly = findLatestManagerWeeklyForNewcomer(db, newcomerId);
        const joinedAt = taskStates.find((task) => task.taskKey === 'join_feishu_org' && task.status === 'completed')?.completedAt;
        const onboardingStage = calculateOnboardingStage(joinedAt, newcomer.stage);
        const weeklyStatus = weekly ? feedbackActionLabel(String(weekly.managerActionStatus ?? 'unread')) : '未提交';

        return {
          scope: { managerName },
          newcomer: { ...newcomer, stage: onboardingStage, taskStates },
          weeklyFeedback: weekly
            ? {
                id: weekly.id,
                statusText: weeklyStatus,
                overallFeeling: String(weekly.overallFeeling ?? ''),
                blockers: splitWeeklyText(weekly.blockers),
                supportNeeded: splitWeeklyText(weekly.supportNeeded),
                message: String(weekly.message ?? ''),
                workSummary: findManagerWeeklyWorkSummary(db, String(weekly.id)) || String(weekly.workSummary ?? '').trim(),
              }
            : null,
        };
      }

export const getManagerOverview: RouteMatch['handler'] = ({ db, request }) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        const managerName = currentManagerName(request);
        const limit = pageNumber(url.searchParams.get('limit'), 20, 50);
        const offset = pageNumber(url.searchParams.get('offset'), 0, 10000);
        const candidates = listManagerOverviewRows(db, managerName).map((row) => ({
          ...row,
          stage: calculateOnboardingStage(row.feishuJoinedAt, row.stage),
        }));
        const weeklyRows = candidates.filter((row) => isWeeklyArrivalStage(String(row.stage)));
        const rows = weeklyRows.slice(offset, offset + limit);
        const total = weeklyRows.length;
        const roleStats = listManagerRoleStats(db);
        const recentWeeklyFeedbackId =
          rows.find((row) => row.latestWeeklyFeedbackId)?.latestWeeklyFeedbackId ??
          normalizeRow(db.prepare(
            `SELECT wf.id
             FROM weekly_feedbacks wf
             JOIN newcomers n ON n.id = wf.newcomerId
             WHERE n.managerName = ? AND wf.visibleToManager = 1
             ORDER BY wf.submittedAt DESC
             LIMIT 1`,
          ).get(managerName) as Record<string, unknown> | undefined)?.id ??
          '';

        return {
          data: {
            scope: { managerName },
            summary: {
              visibleNewcomerCount: candidates.length,
              submittedWeeklyCount: candidates.filter((row) => row.latestWeeklyFeedbackId).length,
              pendingManagerActionCount: candidates.filter((row) => onboardingStatus(row) !== 'on_track').length,
            },
            roleStats: roleStats.map((item) => ({
              ...item,
              count: candidates.filter((row) => row.roleId === item.roleId).length,
            })),
            recentWeeklyFeedbackId,
            newcomers: rows.map((row) => ({
              id: row.id,
              name: row.name,
              roleName: row.roleName,
              department: row.department,
              stage: row.stage,
              managerName: row.managerName,
              mentorName: row.mentorName,
              d1GuideCompleted: row.d1GuideCompleted,
              permissionPackageViewed: row.permissionPackageViewed,
              weeklyFeedbackSubmitted: Boolean(row.latestWeeklyFeedbackId),
              managerViewedFeedback: row.managerViewedFeedback,
              pendingFollowUpCount: Number(row.pendingFollowUpCount),
              pendingPermissionCount: Number(row.pendingPermissionCount),
              weeklyFeedbackId: row.latestWeeklyFeedbackId ?? null,
              managerActionStatus: row.latestManagerActionStatus ?? 'unread',
              includeReason: includeReason(row),
              onboardingStatus: onboardingStatus(row),
              primaryAction: primaryAction(row),
            })),
            page: { limit, offset, hasMore: offset + rows.length < total },
          },
        };
      };

export const getManagerNewcomerDetail: RouteMatch['handler'] = ({ db, request }, match) => {
        const managerName = currentManagerName(request);
        const detail = buildManagerNewcomerDetail(db, managerName, decodeURIComponent(match[1]));
        return detail ? { data: detail } : { status: 404, error: 'Manager newcomer detail not found' };
      };

export const getManagerFeedback: RouteMatch['handler'] = ({ db, request }, match) => {
        const managerName = currentManagerName(request);
        const weeklyFeedbackId = decodeURIComponent(match[1]);
        const allowed = findManagerWeeklyById(db, { managerName, weeklyFeedbackId });
        if (!allowed) return { status: 404, error: 'Weekly feedback not found' };
        const row = getWeeklyWithAction(db, weeklyFeedbackId);
        return row ? { data: row } : { status: 404, error: 'Weekly feedback not found' };
      };

export const updateManagerFeedbackAction: RouteMatch['handler'] = async ({ db, request }, match) => {
        const weeklyFeedbackId = decodeURIComponent(match[1]);
        const managerName = currentManagerName(request);
        const allowed = findManagerWeeklyById(db, { managerName, weeklyFeedbackId });
        if (!allowed) return { status: 404, error: 'Manager action not found' };
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
