export type Role = {
  id: string;
  name: string;
  departmentId?: string;
  department: string;
  description: string;
  enabled?: boolean;
  updatedBy?: string;
};

export type PermissionItem = {
  id: string;
  name: string;
  category: string;
  permissionType: 'required' | 'optional';
  sensitive: boolean;
  ownerType: 'personal' | 'department' | 'group' | string;
  ownerName: string;
  ownerContact: string;
  applyEntryName: string;
  applyUrl: string;
  reasonTemplate: string;
  approverName: string;
  commonWaitingReasons: string[];
  enabled: boolean;
  updatedBy?: string;
  updatedAt?: string;
};

export type RolePermissionItem = {
  id: string;
  roleId: string;
  permissionItemId: string;
  sortOrder: number;
  updatedBy?: string;
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
  rolePermissionItems: RolePermissionItem[];
};

export type AnonymousFeedback = {
  id: string;
  feedbackNo: string;
  type: string;
  module: string;
  description: string;
  expectedAction?: string;
  isAnonymous: boolean;
  ownerName?: string;
  result?: string;
  handlerName?: string;
  handledAt?: string;
  resolutionNote?: string;
  updatedBy?: string;
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
  updatedBy?: string;
};

export type AnonymousFeedbackExpectedAction = {
  id: string;
  moduleId: string;
  actionKey: string;
  label: string;
  requiresText: boolean;
  enabled: boolean;
  sortOrder: number;
  updatedBy?: string;
};

export type AnonymousFeedbackModule = {
  id: string;
  moduleKey: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
  updatedBy?: string;
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
  applicableRoleId: string;
  applicableRole: string;
  applicableStage: string;
  ownerName: string;
  sourceUrl?: string;
  fileSize?: number;
  fileHash?: string;
  filePath?: string;
  contentText?: string;
  retrievalKeywords?: string;
  status: string;
  parseStatus: string;
  vectorStatus: string;
  hitCount: number;
  updatedBy?: string;
  updatedAt?: string;
};

export type D1GuideConfigItem = {
  actionKey: string;
  taskType?: 'join_group' | 'employee_guide' | 'permission_package' | 'custom_link' | string;
  organizationPath?: string;
  departmentId?: string;
  departmentName?: string;
  roleId?: string;
  roleName?: string;
  title: string;
  description: string;
  targetGroupName?: string | null;
  applyUrl?: string | null;
  sendToEmployeeName?: string | null;
  sendToEmployeeContact?: string | null;
  documentTitle?: string | null;
  documentUrl?: string | null;
  resourceLinks?: Array<{ name?: string; url?: string; chatId?: string; qrCodeUrl?: string }>;
  routePath?: string | null;
  label: string;
  ownerName: string;
  enabled: boolean;
  updatedBy?: string;
  updatedAt?: string;
  sortOrder?: number;
};

export type D1GuideConfig = {
  items?: D1GuideConfigItem[];
  joinGroup: D1GuideConfigItem | null;
  employeeGuide: D1GuideConfigItem | null;
  permissionPackage: D1GuideConfigItem | null;
};

export type D1GuideMessageDelivery = {
  deliveryStatus: 'sent' | 'failed' | 'skipped';
  alreadySent?: boolean;
  messageId?: string;
  recipientName: string;
  itemCount: number;
  sentAt: string;
};

export type HomeAiAnswer = {
  mode: 'coze' | 'local_rag' | 'no_match';
  answer: string;
  citations: Array<{
    docId: string;
    title: string;
    ownerName: string;
    sourceUrl?: string;
  }>;
};

export type WeeklyFeedback = {
  id: string;
  newcomerId: string;
  overallFeeling: string;
  blockers: string;
  supportNeeded: string;
  message: string;
  workSummary?: string;
  visibleToManager: boolean;
  lifecycle: string;
  managerAction?: {
    managerViewed: boolean;
    managerActionStatus: string;
    actionNote: string;
  };
};

export type ManagerOverviewNewcomer = {
  id: string;
  name: string;
  roleName: string;
  department: string;
  stage: string;
  managerName: string;
  mentorName: string;
  d1GuideCompleted: boolean;
  permissionPackageViewed: boolean;
  weeklyFeedbackSubmitted: boolean;
  managerViewedFeedback: boolean;
  pendingFollowUpCount: number;
  pendingPermissionCount: number;
  weeklyFeedbackId?: string | null;
  managerActionStatus: string;
  includeReason: 'first_week' | 'pending_todo';
  onboardingStatus: 'weekly_feedback_pending_review' | 'permission_pending_follow_up' | 'on_track';
  primaryAction: {
    type: 'view_feedback' | 'remind_mentor' | 'view_detail';
    label: string;
    targetPath?: string;
  };
};

export type ManagerOverview = {
  scope: { managerName: string };
  summary: {
    visibleNewcomerCount: number;
    submittedWeeklyCount: number;
    pendingManagerActionCount: number;
  };
  roleStats: Array<{ roleId: string; roleName: string; count: number }>;
  recentWeeklyFeedbackId?: string;
  newcomers: ManagerOverviewNewcomer[];
  page: { limit: number; offset: number; hasMore: boolean };
};

export type ManagerNewcomerDetail = {
  scope: { managerName: string };
  newcomer: Newcomer & { roleName?: string };
  weeklyFeedback: {
    id: string;
    statusText: string;
    overallFeeling: string;
    blockers: string[];
    supportNeeded: string[];
    message: string;
    workSummary: string;
  } | null;
};

export type WeeklyFeedbackOption = {
  id: string;
  questionId: string;
  optionKey: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
  updatedBy?: string;
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
  updatedBy?: string;
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

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INVALID_JSON'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR';

export type AuthSession = {
  enabled: boolean;
  authenticated: boolean;
  loginUrl?: string;
  user?: {
    openId: string;
    unionId?: string;
    userId?: string;
    name: string;
    departmentName?: string;
    jobTitle?: string;
    email?: string;
    mobile?: string;
    avatarUrl?: string;
    newcomerId: string;
    canAccessAdminConfig?: boolean;
  } | null;
};

type ApiPayload<T> = {
  data?: T;
  error?: string;
  code?: ApiErrorCode;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly path: string;
  readonly method: string;

  constructor(message: string, options: { status: number; code: ApiErrorCode; path: string; method: string }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.path = options.path;
    this.method = options.method;
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function formatApiErrorMessage(error: unknown, fallback = '后端数据加载失败'): string {
  if (!isApiClientError(error)) return error instanceof Error ? error.message : fallback;
  if (error.code === 'NETWORK_ERROR') return '后端未连接，请确认 API 服务已启动。';
  if (error.code === 'NOT_FOUND') return `接口不存在或数据不存在：${error.path}`;
  if (error.code === 'INVALID_JSON') return '请求数据格式错误，请刷新页面后重试。';
  if (error.code === 'VALIDATION_ERROR' || error.code === 'BAD_REQUEST') return error.message;
  return fallback;
}

async function readApiPayload<T>(response: Response, path: string, method: string): Promise<ApiPayload<T>> {
  try {
    return (await response.json()) as ApiPayload<T>;
  } catch {
    throw new ApiClientError('Backend response is not valid JSON', { status: response.status, code: 'PARSE_ERROR', path, method });
  }
}

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET';
  const headers = {
    ...(path.startsWith('/api/admin/') || path.startsWith('/api/admin-config/')
      ? { 'x-haina-role': 'admin', 'x-haina-actor': 'demo-admin' }
      : {}),
    ...(init?.headers ?? {}),
  };
  try {
    const response = await fetch(path, { ...init, headers, credentials: 'include' });
    const payload = await readApiPayload<T>(response, path, method);
    if (!response.ok || payload.error) {
      throw new ApiClientError(payload.error ?? `Request failed: ${path}`, {
        status: response.status,
        code: payload.code ?? (response.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST'),
        path,
        method,
      });
    }
    return payload.data as T;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError('Backend is not reachable', { status: 0, code: 'NETWORK_ERROR', path, method });
  }
}

async function apiGet<T>(path: string): Promise<T> {
  return requestApi<T>(path);
}

async function apiSend<T>(path: string, method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<T> {
  return requestApi<T>(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const api = {
  getAuthSession: (returnTo = `${window.location.pathname}${window.location.search}`) =>
    apiGet<AuthSession>(`/api/auth/session?returnTo=${encodeURIComponent(returnTo)}`),
  getRoles: () => apiGet<Role[]>('/api/roles'),
  getNewcomer: (id: string) => apiGet<Newcomer>(`/api/newcomers/${id}`),
  getPermissionPackage: (roleId: string) => apiGet<PermissionPackage>(`/api/roles/${roleId}/permission-package`),
  getPermissionProgress: (newcomerId: string) => apiGet<PermissionProgress[]>(`/api/newcomers/${newcomerId}/permission-progress`),
  getFollowUpTasks: (newcomerId: string) => apiGet<FollowUpTask[]>(`/api/newcomers/${newcomerId}/follow-up-tasks`),
  getAdminConfig: () => apiGet<AdminConfig>('/api/admin/config'),
  getKnowledgeDocs: () => apiGet<KnowledgeDoc[]>('/api/admin/knowledge-base-docs'),
  createKnowledgeDoc: (body: {
    title: string;
    category: string;
    applicableRoleId: string;
    applicableRole: string;
    applicableStage: string;
    sourceUrl?: string;
    fileSize?: number;
    fileHash?: string;
    filePath?: string;
    contentText?: string;
    retrievalKeywords?: string;
    ownerName: string;
    updatedBy?: string;
  }) => apiSend<KnowledgeDoc>('/api/admin/knowledge-base-docs', 'POST', body),
  triggerMockKnowledgeParse: (id: string) => apiSend<KnowledgeDoc>(`/api/admin-config/knowledge/${id}/trigger-mock-parse`, 'POST', {}),
  updateKnowledgeDocStatus: (id: string, status: 'disabled' | 'enabled' | 'offline') =>
    apiSend<KnowledgeDoc>(`/api/admin-config/knowledge/${id}/status`, 'PATCH', { status }),
  createRole: (body: { name: string; departmentId?: string; department: string; description: string; enabled?: boolean; updatedBy?: string }) =>
    apiSend<Role>('/api/admin/roles', 'POST', body),
  createPosition: (body: { name: string; departmentId: string; department: string; description: string; enabled?: boolean; updatedBy?: string }) =>
    apiSend<Role>('/api/admin-config/positions', 'POST', body),
  updateRole: (id: string, body: { name?: string; department?: string; description?: string; enabled?: boolean; updatedBy?: string }) =>
    apiSend<Role>(`/api/admin/roles/${id}`, 'PATCH', body),
  createPermissionItem: (body: {
    name: string;
    category: string;
    permissionType: 'required' | 'optional';
    ownerType?: 'personal' | 'department' | 'group' | string;
    ownerName: string;
    ownerContact: string;
    applyEntryName: string;
    applyUrl: string;
    reasonTemplate: string;
    approverName: string;
    commonWaitingReasons: string[];
    enabled?: boolean;
    updatedBy?: string;
  }) => apiSend<PermissionItem>('/api/admin/permission-items', 'POST', body),
  createRolePermissionItem: (body: { roleId: string; permissionItemId: string; sortOrder?: number; updatedBy?: string }) =>
    apiSend<RolePermissionItem>('/api/admin/role-permission-items', 'POST', body),
  updatePermissionItem: (
    id: string,
    body: Partial<
      Pick<
        PermissionItem,
        | 'name'
        | 'category'
        | 'permissionType'
        | 'sensitive'
        | 'ownerType'
        | 'ownerName'
        | 'ownerContact'
        | 'applyEntryName'
        | 'applyUrl'
        | 'reasonTemplate'
        | 'approverName'
        | 'commonWaitingReasons'
        | 'enabled'
        | 'updatedAt'
      >
    > & { expectedUpdatedAt?: string },
  ) => apiSend<PermissionItem>(`/api/admin/permission-items/${id}`, 'PATCH', body),
  syncPermissionApplications: (newcomerId: string, selectedPermissionItemIds: string[], scopePermissionItemIds: string[]) =>
    apiSend<{ selectedPermissionItemIds: string[]; removedPermissionItemIds: string[] }>(
      `/api/newcomers/${newcomerId}/permission-applications`,
      'PATCH',
      { selectedPermissionItemIds, scopePermissionItemIds },
    ),
  updateNewcomerTaskState: (newcomerId: string, taskKey: string, status: 'pending' | 'in_progress' | 'completed') =>
    apiSend<{ taskKey: string; status: string; completedAt?: string | null }>(
      `/api/newcomers/${newcomerId}/task-states/${taskKey}`,
      'PATCH',
      { status },
    ),
  submitPermissionProgress: (newcomerId: string, permissionItemId: string) =>
    apiSend<{
      progress: { id: string; status: string; submittedAt: string };
      followUpTask: { id: string; status: string; followUpAt: string };
    }>(`/api/newcomers/${newcomerId}/permission-progress`, 'POST', {
      permissionItemId,
      status: 'submitted',
    }),
  askHomeAi: (newcomerId: string, body: { question: string }) =>
    apiSend<HomeAiAnswer>(`/api/newcomers/${newcomerId}/ai-chat`, 'POST', body),
};
