export type Role = {
  id: string;
  name: string;
  department: string;
  description: string;
};

export type PermissionItem = {
  id: string;
  name: string;
  category: string;
  permissionType: 'required' | 'optional';
  sensitive: boolean;
  ownerName: string;
  ownerContact: string;
  applyUrl: string;
  reasonTemplate: string;
  approverName: string;
  commonWaitingReasons: string[];
  enabled: boolean;
};

export type Newcomer = {
  id: string;
  name: string;
  roleId: string;
  department: string;
  stage: string;
  managerName: string;
  mentorName: string;
  status: string;
  d1GuideCompleted: boolean;
  permissionPackageViewed: boolean;
  weeklyFeedbackSubmitted: boolean;
  managerViewedFeedback: boolean;
  taskStates?: Array<{ taskKey: string; taskName: string; status: string; completedAt?: string | null }>;
};

export type PermissionPackage = {
  role: Role;
  requiredPermissions: PermissionItem[];
  optionalPermissions: PermissionItem[];
};

export type PermissionProgress = {
  permissionItemId: string;
  permissionName: string;
  status: string;
  submittedAt?: string;
  ownerName?: string;
};

export type FollowUpTask = {
  id: string;
  newcomerId: string;
  permissionProgressId: string;
  permissionItemId?: string;
  permissionName?: string;
  permissionType?: 'required' | 'optional';
  status: string;
  submittedAt: string;
  followUpAt: string;
  ownerName: string;
};

export type AdminConfig = {
  roles: Role[];
  permissionItems: PermissionItem[];
  rolePermissionItems: unknown[];
  d1GuideConfig?: D1GuideConfig;
  anonymousFeedbackConfig?: AnonymousFeedbackConfig;
  anonymousFeedbacks: AnonymousFeedback[];
};

export type AnonymousFeedback = {
  id: string;
  feedbackNo: string;
  type: string;
  module: string;
  description: string;
  expectedAction?: string;
  status: string;
  includedInReview: boolean;
  detail?: {
    moduleKey: string;
    problemTypeKey: string;
    problemTypeOtherText?: string;
    expectedActionKeys: string[];
    expectedActionOtherText?: string;
  } | null;
};

export type AnonymousFeedbackProblemType = {
  id: string;
  moduleId: string;
  typeKey: string;
  label: string;
  requiresText: boolean;
  enabled: boolean;
  sortOrder: number;
};

export type AnonymousFeedbackExpectedAction = {
  id: string;
  moduleId: string;
  actionKey: string;
  label: string;
  requiresText: boolean;
  enabled: boolean;
  sortOrder: number;
};

export type AnonymousFeedbackModule = {
  id: string;
  moduleKey: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
  problemTypes: AnonymousFeedbackProblemType[];
  expectedActions: AnonymousFeedbackExpectedAction[];
};

export type AnonymousFeedbackConfig = {
  modules: AnonymousFeedbackModule[];
};

export type ReviewMetrics = {
  newcomerCount: number;
  submittedPermissionCount: number;
  pendingFollowUpCount: number;
  anonymousFeedbackCount: number;
  weeklyFeedbackCount: number;
  knowledgeDocCount: number;
};

export type KnowledgeDoc = {
  id: string;
  title: string;
  category: string;
  applicableRole: string;
  applicableStage: string;
  ownerName: string;
  status: string;
  parseStatus: string;
  vectorStatus: string;
  hitCount: number;
};

export type D1GuideConfigItem = {
  actionKey: string;
  title: string;
  description: string;
  targetGroupName?: string | null;
  applyUrl?: string | null;
  sendToEmployeeName?: string | null;
  sendToEmployeeContact?: string | null;
  documentTitle?: string | null;
  documentUrl?: string | null;
  routePath?: string | null;
  label: string;
  ownerName: string;
  enabled: boolean;
};

export type D1GuideConfig = {
  joinGroup: D1GuideConfigItem;
  employeeGuide: D1GuideConfigItem;
  permissionPackage: D1GuideConfigItem;
};

export type WeeklyFeedback = {
  id: string;
  newcomerId: string;
  overallFeeling: string;
  blockers: string;
  supportNeeded: string;
  message: string;
  visibleToManager: boolean;
  lifecycle: string;
  managerAction?: {
    managerViewed: boolean;
    managerActionStatus: string;
    actionNote: string;
  };
};

export type WeeklyFeedbackOption = {
  id: string;
  questionId: string;
  optionKey: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
};

export type WeeklyFeedbackQuestion = {
  id: string;
  questionKey: 'overall_feeling' | 'blockers' | 'support_needed' | 'message' | string;
  title: string;
  description?: string;
  inputType: 'single' | 'multi' | 'text';
  required: boolean;
  maxLength?: number | null;
  enabled: boolean;
  sortOrder: number;
  options: WeeklyFeedbackOption[];
};

export type WeeklyFeedbackConfig = {
  questions: WeeklyFeedbackQuestion[];
};

export type WeeklyFeedbackAnalysis = {
  submissionCount: number;
  questions: Array<{
    questionKey: string;
    title: string;
    inputType: string;
    options: Array<{ label: string; count: number }>;
  }>;
};

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const payload = (await response.json()) as { data?: T; error?: string };
  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? `Request failed: ${path}`);
  }
  return payload.data as T;
}

async function apiSend<T>(path: string, method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { data?: T; error?: string };
  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? `Request failed: ${path}`);
  }
  return payload.data as T;
}

export const api = {
  getRoles: () => apiGet<Role[]>('/api/roles'),
  getNewcomer: (id: string) => apiGet<Newcomer>(`/api/newcomers/${id}`),
  getPermissionPackage: (roleId: string) => apiGet<PermissionPackage>(`/api/roles/${roleId}/permission-package`),
  getPermissionProgress: (newcomerId: string) => apiGet<PermissionProgress[]>(`/api/newcomers/${newcomerId}/permission-progress`),
  getFollowUpTasks: (newcomerId: string) => apiGet<FollowUpTask[]>(`/api/newcomers/${newcomerId}/follow-up-tasks`),
  getD1GuideConfig: () => apiGet<D1GuideConfig>('/api/d1-guide-config'),
  getAdminConfig: () => apiGet<AdminConfig>('/api/admin/config'),
  getAnonymousFeedbacks: () => apiGet<AnonymousFeedback[]>('/api/admin/anonymous-feedbacks'),
  getKnowledgeDocs: () => apiGet<KnowledgeDoc[]>('/api/admin/knowledge-base-docs'),
  createKnowledgeDoc: (body: {
    title: string;
    category: string;
    applicableRole: string;
    applicableStage: string;
    sourceUrl?: string;
    ownerName: string;
  }) => apiSend<KnowledgeDoc>('/api/admin/knowledge-base-docs', 'POST', body),
  getReviewMetrics: () => apiGet<ReviewMetrics>('/api/review/metrics'),
  getWeeklyFeedbackConfig: () => apiGet<WeeklyFeedbackConfig>('/api/weekly-feedback-config'),
  getWeeklyFeedbackAnalysis: () => apiGet<WeeklyFeedbackAnalysis>('/api/admin/weekly-feedback-analysis'),
  getAnonymousFeedbackConfig: () => apiGet<AnonymousFeedbackConfig>('/api/anonymous-feedback-config'),
  updateWeeklyFeedbackConfig: (questions: Array<{ id: string; title: string; options?: Array<{ id: string; label: string }> }>) =>
    apiSend<WeeklyFeedbackConfig>('/api/admin/weekly-feedback-config', 'PATCH', { questions }),
  getWeeklyFeedback: (newcomerId: string) => apiGet<WeeklyFeedback>(`/api/newcomers/${newcomerId}/weekly-feedback`),
  getManagerFeedback: (weeklyFeedbackId: string) => apiGet<WeeklyFeedback>(`/api/manager/feedback/${weeklyFeedbackId}`),
  syncPermissionApplications: (newcomerId: string, selectedPermissionItemIds: string[], scopePermissionItemIds: string[]) =>
    apiSend<{ selectedPermissionItemIds: string[]; removedPermissionItemIds: string[] }>(
      `/api/newcomers/${newcomerId}/permission-applications`,
      'PATCH',
      { selectedPermissionItemIds, scopePermissionItemIds },
    ),
  submitPermissionProgress: (newcomerId: string, permissionItemId: string) =>
    apiSend<{
      progress: { id: string; status: string; submittedAt: string };
      followUpTask: { id: string; status: string; followUpAt: string };
    }>(`/api/newcomers/${newcomerId}/permission-progress`, 'POST', {
      permissionItemId,
      status: 'submitted',
    }),
  submitAnonymousFeedback: (body: {
    type?: string;
    module?: string;
    description: string;
    expectedAction?: string;
    moduleKey?: string;
    problemTypeKey?: string;
    problemTypeOtherText?: string;
    expectedActionKeys?: string[];
    expectedActionOtherText?: string;
    isAnonymous: boolean;
    contactName?: string;
    contactInfo?: string;
    submittedByNewcomerId?: string;
  }) => apiSend<AnonymousFeedback>('/api/anonymous-feedbacks', 'POST', body),
  submitWeeklyFeedback: (body: {
    newcomerId: string;
    overallFeeling?: string;
    blockers?: string;
    supportNeeded?: string;
    message?: string;
    answers?: Array<{ questionId: string; selectedOptionIds?: string[]; textValue?: string }>;
  }) => apiSend<WeeklyFeedback>('/api/weekly-feedbacks', 'POST', body),
  updateManagerFeedbackAction: (weeklyFeedbackId: string, managerActionStatus: string, actionNote: string) =>
    apiSend<{ managerViewed: boolean; managerActionStatus: string; actionNote: string }>(
      `/api/manager/feedback/${weeklyFeedbackId}/action`,
      'PATCH',
      { managerActionStatus, actionNote },
    ),
};
