import type { RouteMatch } from '../routeKit.ts';
import { count } from '../repositories/metricsRepository.ts';

export const getReviewMetrics: RouteMatch['handler'] = ({ db }) => ({
        data: {
          newcomerCount: count(db, 'newcomers'),
          submittedPermissionCount: Number(
            (db.prepare("SELECT COUNT(*) AS total FROM permission_progress WHERE status IN ('submitted', 'completed')").get() as { total: number }).total,
          ),
          pendingFollowUpCount: Number((db.prepare("SELECT COUNT(*) AS total FROM follow_up_tasks WHERE status = 'pending'").get() as { total: number }).total),
          anonymousFeedbackCount: count(db, 'anonymous_feedbacks'),
          weeklyFeedbackCount: count(db, 'weekly_feedbacks'),
          knowledgeDocCount: count(db, 'knowledge_base_docs'),
        },
      });
