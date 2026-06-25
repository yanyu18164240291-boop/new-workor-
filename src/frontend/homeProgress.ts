type HomePermission = {
  id: string;
  permissionType: 'required' | 'optional';
};

type HomeProgressRecord = {
  permissionItemId: string;
  status: string;
};

type HomeFollowUpTask = {
  permissionItemId?: string;
  permissionProgressId?: string;
  status: string;
};

type HomeNewcomer = {
  stage?: string;
  taskStates?: Array<{
    taskKey: string;
    taskName?: string;
    status: string;
    completedAt?: string | null;
  }>;
};

export type HomeProgressStat = {
  value: string | number;
  label: string;
};

function isOpenedPermission(status: string): boolean {
  return ['completed', 'opened'].includes(status);
}

function isPendingFollowUp(status: string): boolean {
  return !['completed', 'resolved', 'closed'].includes(status);
}

export function calculateOnboardingStage(joinedAt?: string | null, now = new Date(), fallback = 'D1'): string {
  if (!joinedAt) return fallback;
  const joinedDate = new Date(joinedAt);
  if (Number.isNaN(joinedDate.getTime())) return fallback;

  const joinedDay = new Date(joinedDate.getFullYear(), joinedDate.getMonth(), joinedDate.getDate()).getTime();
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const elapsedDays = Math.floor((currentDay - joinedDay) / 86_400_000) + 1;
  return `D${Math.max(elapsedDays, 1)}`;
}

export function getFeishuOrgJoinedAt(newcomer?: HomeNewcomer): string | null {
  const task = newcomer?.taskStates?.find((item) => item.taskKey === 'join_feishu_org' && item.status === 'completed');
  return task?.completedAt ?? null;
}

export function buildHomeProgressStats({
  permissions,
  progress,
  followUps,
  newcomer,
  now = new Date(),
}: {
  permissions: HomePermission[];
  progress: HomeProgressRecord[];
  followUps: HomeFollowUpTask[];
  newcomer?: HomeNewcomer;
  now?: Date;
}): HomeProgressStat[] {
  const openedPermissionIds = new Set(progress.filter((item) => isOpenedPermission(item.status)).map((item) => item.permissionItemId));
  const required = permissions.filter((item) => item.permissionType === 'required');
  const optional = permissions.filter((item) => item.permissionType === 'optional');
  const openedRequired = required.filter((item) => openedPermissionIds.has(item.id)).length;
  const openedOptional = optional.filter((item) => openedPermissionIds.has(item.id)).length;
  const pendingFollowUpKeys = new Set(
    followUps
      .filter((item) => isPendingFollowUp(item.status))
      .map((item) => item.permissionItemId ?? item.permissionProgressId)
      .filter((key): key is string => Boolean(key)),
  );

  return [
    { value: `${openedRequired}/${required.length}`, label: '必开权限' },
    { value: `${openedOptional}/${optional.length}`, label: '可选权限' },
    { value: pendingFollowUpKeys.size, label: '待回访权限' },
    { value: calculateOnboardingStage(getFeishuOrgJoinedAt(newcomer), now, newcomer?.stage ?? 'D1'), label: '入职阶段' },
  ];
}
