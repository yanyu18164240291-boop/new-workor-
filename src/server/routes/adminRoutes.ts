import type { RouteMatch } from '../routeKit.ts';
import {
  getAdminConfig,
  listKnowledgeBaseDocs,
  createRole,
  createPosition,
  updateRole,
  createPermissionItem,
  createRolePermissionItem,
  createKnowledgeBaseDoc,
  triggerMockKnowledgeParse,
  updateKnowledgeBaseDocStatus,
  updatePermissionItem,
  acceptAdminConfigPatch,
} from '../services/adminService.ts';

export const adminRoutes: Record<string, RouteMatch[]> = {
  GET: [
    {
      pattern: /^\/api\/admin\/config$/,
      handler: getAdminConfig,
    },
    {
      pattern: /^\/api\/admin\/knowledge-base-docs$/,
      handler: listKnowledgeBaseDocs,
    },
  ],
  POST: [
    {
      pattern: /^\/api\/admin\/roles$/,
      handler: createRole,
    },
    {
      pattern: /^\/api\/admin-config\/positions$/,
      handler: createPosition,
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
      pattern: /^\/api\/admin-config\/knowledge\/([^/]+)\/trigger-mock-parse$/,
      handler: triggerMockKnowledgeParse,
    },
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
      pattern: /^\/api\/admin-config\/knowledge\/([^/]+)\/status$/,
      handler: updateKnowledgeBaseDocStatus,
    },
    {
      pattern: /^\/api\/admin\/config$/,
      handler: acceptAdminConfigPatch,
    },
  ],
};
