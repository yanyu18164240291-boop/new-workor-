import type { RouteMatch } from '../routeKit.ts';
import {
  answerNewcomerAiChat,
} from '../services/aiQaService.ts';
import {
  listRoles,
  getRolePermissionPackage,
  getPermissionItem,
  getPermissionRoute,
  getNewcomer,
  listPermissionProgress,
  listFollowUpTasks,
  listFollowUpMessageCards,
  getFollowUpTask,
  createPermissionProgress,
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
      pattern: /^\/api\/follow-up-tasks\/([^/]+)$/,
      handler: getFollowUpTask,
    },
  ],
  POST: [
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/permission-progress$/,
      handler: createPermissionProgress,
    },
    {
      pattern: /^\/api\/follow-up-message-cards\/dispatch$/,
      handler: dispatchFollowUpMessageCards,
    },
    {
      pattern: /^\/api\/newcomers\/([^/]+)\/ai-chat$/,
      handler: answerNewcomerAiChat,
    },
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
    },
  ],
};
