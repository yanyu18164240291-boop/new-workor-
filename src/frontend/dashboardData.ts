import type {
  AdminConfig,
  FollowUpTask,
  KnowledgeDoc,
  Newcomer,
  PermissionPackage,
  PermissionProgress,
  Role,
  AuthSession,
} from './api.ts';

export type DashboardData = {
  newcomer?: Newcomer;
  roles?: Role[];
  selectedRoleId?: string;
  authSession?: AuthSession;
  package?: PermissionPackage;
  progress?: PermissionProgress[];
  followUps?: FollowUpTask[];
  admin?: AdminConfig;
  knowledgeDocs?: KnowledgeDoc[];
  __staleWhileRevalidate?: boolean;
};
