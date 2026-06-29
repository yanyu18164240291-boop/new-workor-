import type { RouteMatch } from '../routeKit.ts';
import {
  listAdminAnonymousFeedbacks,
  getAdminConfig,
  listKnowledgeBaseDocs,
  getWeeklyFeedbackAnalysis,
  createRole,
  updateRole,
  createPermissionItem,
  createRolePermissionItem,
  createKnowledgeBaseDoc,
  createWeeklyFeedbackQuestion,
  updatePermissionItem,
  updateWeeklyFeedbackConfig,
  updateD1GuideConfig,
  updateAnonymousFeedbackConfig,
  updateAnonymousFeedback,
  acceptAdminConfigPatch
} from '../services/adminService.ts';

export const adminRoutes: Record<string, RouteMatch[]> = {
  GET: [
    {
      pattern: /^\/api\/admin\/anonymous-feedbacks$/,
      handler: listAdminAnonymousFeedbacks,
    },
    {
      pattern: /^\/api\/admin\/config$/,
      handler: getAdminConfig,
    },
    {
      pattern: /^\/api\/admin\/knowledge-base-docs$/,
      handler: listKnowledgeBaseDocs,
    },
    {
      pattern: /^\/api\/admin\/weekly-feedback-analysis$/,
      handler: getWeeklyFeedbackAnalysis,
    }
  ],
  POST: [
    {
      pattern: /^\/api\/admin\/roles$/,
      handler: createRole,
    },
    {
      pattern: /^\/api\/admin\/permission-items$/,
      handler: createPermissionItem,
    },
    {
      pattern: /^\/api\/admin\/role-permission-items$/,
      handler: createRolePermissionItem,
    },
    {
      pattern: /^\/api\/admin\/knowledge-base-docs$/,
      handler: createKnowledgeBaseDoc,
    },
    {
      pattern: /^\/api\/admin\/weekly-feedback-config\/questions$/,
      handler: createWeeklyFeedbackQuestion,
    }
  ],
  PATCH: [
    {
      pattern: /^\/api\/admin\/roles\/([^/]+)$/,
      handler: updateRole,
    },
    {
      pattern: /^\/api\/admin\/permission-items\/([^/]+)$/,
      handler: updatePermissionItem,
    },
    {
      pattern: /^\/api\/admin\/d1-guide-config$/,
      handler: updateD1GuideConfig,
    },
    {
      pattern: /^\/api\/admin\/weekly-feedback-config$/,
      handler: updateWeeklyFeedbackConfig,
    },
    {
      pattern: /^\/api\/admin\/anonymous-feedback-config$/,
      handler: updateAnonymousFeedbackConfig,
    },
    {
      pattern: /^\/api\/admin\/anonymous-feedbacks\/([^/]+)$/,
      handler: updateAnonymousFeedback,
    },
    {
      pattern: /^\/api\/admin\/config$/,
      handler: acceptAdminConfigPatch,
    }
  ],
};
