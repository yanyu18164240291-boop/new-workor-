import type { RouteMatch } from '../routeKit.ts';
import {
  listRoles,
  getRolePermissionPackage,
  getPermissionItem,
  getPermissionRoute,
  getNewcomer,
  listPermissionProgress,
  listFollowUpTasks,
  listFollowUpMessageCards,
  loadD1GuideConfig,
  sendD1GuideMessage,
  loadWeeklyFeedbackConfig,
  loadAnonymousFeedbackConfig,
  getFollowUpTask,
  getNewcomerWeeklyFeedback,
  createPermissionProgress,
  createAnonymousFeedback,
  createWeeklyFeedback,
  dispatchFollowUpMessageCards,
  updateNewcomerTaskState,
  updateNewcomer,
  updateFollowUpTask,
  syncPermissionApplications
} from '../services/newcomerService.ts';

export const newcomerRoutes: Record<string, RouteMatch[]> = {
  GET: [
    {
      pattern: /^\/api\/roles$/,
      handler: listRoles,
    },
    {
      pattern: /^\/api\/roles\/([^/]+)\/permission-package$/,
      handler: getRolePermissionPackage,
    },
    {
      pattern: /^\/api\/permission-items\/([^/]+)$/,
      handler: getPermissionItem,
    },
    {
      pattern: /^\/api\/permission-items\/([^/]+)\/route$/,
      handler: getPermissionRoute,
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)$/,
      handler: getNewcomer,
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/permission-progress$/,
      handler: listPermissionProgress,
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/follow-up-tasks$/,
      handler: listFollowUpTasks,
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/follow-up-message-cards$/,
      handler: listFollowUpMessageCards,
    },
    {
      pattern: /^\/api\/d1-guide-config$/,
      handler: loadD1GuideConfig,
    },
    {
      pattern: /^\/api\/weekly-feedback-config$/,
      handler: loadWeeklyFeedbackConfig,
    },
    {
      pattern: /^\/api\/anonymous-feedback-config$/,
      handler: loadAnonymousFeedbackConfig,
    },
    {
      pattern: /^\/api\/follow-up-tasks\/([^/]+)$/,
      handler: getFollowUpTask,
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/weekly-feedback$/,
      handler: getNewcomerWeeklyFeedback,
    }
  ],
  POST: [
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/permission-progress$/,
      handler: createPermissionProgress,
    },
    {
      pattern: /^\/api\/anonymous-feedbacks$/,
      handler: createAnonymousFeedback,
    },
    {
      pattern: /^\/api\/weekly-feedbacks$/,
      handler: createWeeklyFeedback,
    },
    {
      pattern: /^\/api\/follow-up-message-cards\/dispatch$/,
      handler: dispatchFollowUpMessageCards,
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/d1-guide-message$/,
      handler: sendD1GuideMessage,
    }
  ],
  PATCH: [
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/task-states\/([^/]+)$/,
      handler: updateNewcomerTaskState,
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)$/,
      handler: updateNewcomer,
    },
    {
      pattern: /^\/api\/follow-up-tasks\/([^/]+)$/,
      handler: updateFollowUpTask,
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/permission-applications$/,
      handler: syncPermissionApplications,
    }
  ],
};
