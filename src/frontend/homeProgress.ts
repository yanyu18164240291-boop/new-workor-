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

export function buildHomeProgressStats({
  permissions,
  progress,
  followUps,
}: {
  permissions: HomePermission[];
  progress: HomeProgressRecord[];
  followUps: HomeFollowUpTask[];
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
  ];
}
