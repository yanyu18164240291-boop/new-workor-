export function createInitialApplySelection(permissionItemIds: string[]): Set<string> {
  return new Set(permissionItemIds);
}

export function toggleApplySelection(selection: Set<string>, permissionItemId: string): Set<string> {
  const next = new Set(selection);
  if (next.has(permissionItemId)) {
    next.delete(permissionItemId);
  } else {
    next.add(permissionItemId);
  }
  return next;
}

export type PermissionUiTone = 'default' | 'success' | 'warning' | 'danger' | 'ai' | 'blue';

export function mapPermissionUiStatus(status?: string): { chip: string; tone: PermissionUiTone } {
  if (status === 'completed') return { chip: '已完成', tone: 'success' };
  if (status === 'rejected') return { chip: '被驳回', tone: 'danger' };
  if (status === 'pending' || status === 'submitted') return { chip: '进行中', tone: 'blue' };
  return { chip: '未申请', tone: 'warning' };
}

export function filterSelectablePermissions<T extends { id: string }>(
  permissions: T[],
  progress: Array<{ permissionItemId: string; status: string }>,
): T[] {
  const existingProgressIds = new Set(progress.map((item) => item.permissionItemId));
  return permissions.filter((item) => !existingProgressIds.has(item.id));
}
