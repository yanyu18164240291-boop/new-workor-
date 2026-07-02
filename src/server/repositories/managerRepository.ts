import type { Database } from '../db.ts';
import { normalizeRow, normalizeRows } from '../routeKit.ts';

export type ManagerOverviewRow = Record<string, unknown> & {
  id: string;
  name: string;
  roleId: string;
  roleName: string;
  department: string;
  stage: string;
  feishuJoinedAt?: string | null;
  managerName: string;
  mentorName: string;
  d1GuideCompleted: number | boolean;
  permissionPackageViewed: number | boolean;
  weeklyFeedbackSubmitted: number | boolean;
  managerViewedFeedback: number | boolean;
  pendingFollowUpCount: number;
  pendingPermissionCount: number;
  latestWeeklyFeedbackId?: string | null;
  latestManagerActionStatus?: string | null;
};

export function listManagerOverviewRows(
  db: Database,
  managerName: string,
): ManagerOverviewRow[] {
  return normalizeRows(
    db
      .prepare(
        `
        SELECT
          n.id,
          n.name,
          n.roleId,
          r.name AS roleName,
          n.department,
          n.stage,
          joinTask.completedAt AS feishuJoinedAt,
          n.managerName,
          n.mentorName,
          n.d1GuideCompleted,
          n.permissionPackageViewed,
          n.weeklyFeedbackSubmitted,
          n.managerViewedFeedback,
          COUNT(DISTINCT CASE WHEN ft.status = 'pending' THEN ft.id END) AS pendingFollowUpCount,
          COUNT(DISTINCT CASE WHEN pp.status IN ('pending', 'submitted') THEN pp.id END) AS pendingPermissionCount,
          wf.id AS latestWeeklyFeedbackId,
          mfa.managerActionStatus AS latestManagerActionStatus,
          wf.submittedAt AS latestWeeklySubmittedAt
        FROM newcomers n
        JOIN roles r ON r.id = n.roleId
        LEFT JOIN newcomer_task_states joinTask
          ON joinTask.newcomerId = n.id
         AND joinTask.taskKey = 'join_feishu_org'
         AND joinTask.status = 'completed'
        LEFT JOIN permission_progress pp ON pp.newcomerId = n.id
        LEFT JOIN follow_up_tasks ft ON ft.newcomerId = n.id
        LEFT JOIN weekly_feedbacks wf ON wf.id = (
          SELECT wf2.id
          FROM weekly_feedbacks wf2
          WHERE wf2.newcomerId = n.id AND wf2.visibleToManager = 1
          ORDER BY wf2.submittedAt DESC
          LIMIT 1
        )
        LEFT JOIN manager_feedback_actions mfa ON mfa.weeklyFeedbackId = wf.id
        WHERE n.managerName = ?
        GROUP BY n.id
        ORDER BY
          CASE
            WHEN pendingFollowUpCount > 0 OR pendingPermissionCount > 0 THEN 0
            WHEN wf.id IS NOT NULL AND COALESCE(mfa.managerActionStatus, 'unread') IN ('unread', 'pending_follow_up') THEN 1
            ELSE 2
          END,
          n.createdAt ASC
        `,
      )
      .all(managerName) as Array<Record<string, unknown>>,
  ) as ManagerOverviewRow[];
}

export function listManagerRoleStats(db: Database): Array<{ roleId: string; roleName: string; count: number }> {
  return normalizeRows(
    db
      .prepare(
        `
        SELECT
          r.id AS roleId,
          r.name AS roleName,
          0 AS count
        FROM roles r
        WHERE r.enabled = 1
        GROUP BY r.id
        ORDER BY r.createdAt ASC
        `,
      )
      .all() as Array<Record<string, unknown>>,
  ).map((row) => ({
    roleId: String(row.roleId),
    roleName: String(row.roleName),
    count: Number(row.count),
  }));
}

export function findManagerNewcomerById(db: Database, options: { managerName: string; newcomerId: string }): Record<string, unknown> | undefined {
  return normalizeRow(
    db
      .prepare(
        `
        SELECT n.*, r.name AS roleName
        FROM newcomers n
        JOIN roles r ON r.id = n.roleId
        WHERE n.id = ? AND n.managerName = ?
        `,
      )
      .get(options.newcomerId, options.managerName) as Record<string, unknown> | undefined,
  );
}

export function listManagerTaskStates(db: Database, newcomerId: string): Array<Record<string, unknown>> {
  return normalizeRows(
    db.prepare('SELECT * FROM newcomer_task_states WHERE newcomerId = ? ORDER BY createdAt').all(newcomerId) as Array<Record<string, unknown>>,
  );
}

export function findLatestManagerWeeklyForNewcomer(db: Database, newcomerId: string): Record<string, unknown> | undefined {
  return normalizeRow(
    db
      .prepare(
        `SELECT wf.*, mfa.managerViewed, mfa.managerActionStatus, mfa.actionNote
         FROM weekly_feedbacks wf
         LEFT JOIN manager_feedback_actions mfa ON mfa.weeklyFeedbackId = wf.id
         WHERE wf.newcomerId = ? AND wf.visibleToManager = 1
         ORDER BY wf.submittedAt DESC
         LIMIT 1`,
      )
      .get(newcomerId) as Record<string, unknown> | undefined,
  );
}

export function findManagerWeeklyWorkSummary(db: Database, weeklyFeedbackId: string): string {
  const row = db
    .prepare(
      `SELECT wfa.textValue
       FROM weekly_feedback_answers wfa
       JOIN weekly_feedback_questions wfq ON wfq.id = wfa.questionId
       WHERE wfa.weeklyFeedbackId = ?
         AND wfa.textValue IS NOT NULL
         AND (wfq.questionKey = 'work_summary' OR wfq.title = '首周工作摘要')
       ORDER BY wfq.sortOrder DESC
       LIMIT 1`,
    )
    .get(weeklyFeedbackId) as { textValue?: string } | undefined;
  return row?.textValue?.trim() ?? '';
}

export function findManagerWeeklyById(db: Database, options: { managerName: string; weeklyFeedbackId: string }): Record<string, unknown> | undefined {
  return normalizeRow(
    db
      .prepare(
        `SELECT wf.*
         FROM weekly_feedbacks wf
         JOIN newcomers n ON n.id = wf.newcomerId
         WHERE wf.id = ? AND wf.visibleToManager = 1 AND n.managerName = ?`,
      )
      .get(options.weeklyFeedbackId, options.managerName) as Record<string, unknown> | undefined,
  );
}
