import type {
  AdminConfig,
  AnonymousFeedback,
  AnonymousFeedbackConfig,
  D1GuideConfig,
  FollowUpTask,
  KnowledgeDoc,
  Newcomer,
  PermissionPackage,
  PermissionProgress,
  ReviewMetrics,
  WeeklyFeedback,
  WeeklyFeedbackAnalysis,
  WeeklyFeedbackConfig,
} from './api.ts';

export type DashboardData = {
  newcomer?: Newcomer;
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
};
