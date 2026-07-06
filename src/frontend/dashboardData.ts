import type {
  AdminConfig,
  AnonymousFeedback,
  AnonymousFeedbackConfig,
  D1GuideConfig,
  FollowUpTask,
  ManagerNewcomerDetail,
  ManagerOverview,
  KnowledgeDoc,
  Newcomer,
  PermissionPackage,
  PermissionProgress,
  ReviewMetrics,
  Role,
  WeeklyFeedback,
  WeeklyFeedbackAnalysis,
  WeeklyFeedbackConfig,
} from './api.ts';

export type DashboardData = {
  newcomer?: Newcomer;
  managerDetail?: ManagerNewcomerDetail;
  managerOverview?: ManagerOverview;
  roles?: Role[];
  selectedRoleId?: string;
  package?: PermissionPackage;
  progress?: PermissionProgress[];
  followUps?: FollowUpTask[];
  admin?: AdminConfig;
  knowledgeDocs?: KnowledgeDoc[];
  metrics?: ReviewMetrics;
  weekly?: WeeklyFeedback;
  weeklyConfig?: WeeklyFeedbackConfig;
  weeklyAnalysis?: WeeklyFeedbackAnalysis;
  anonymousConfig?: AnonymousFeedbackConfig;
  anonymous?: AnonymousFeedback[];
  d1GuideConfig?: D1GuideConfig;
  __staleWhileRevalidate?: boolean;
};
