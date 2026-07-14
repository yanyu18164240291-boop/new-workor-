export const currentAdminUser = {
  name: 'demo-admin',
  role: '后台管理员',
} as const;

export type AdminConfigTabId =
  | 'overview'
  | 'role-packages'
  | 'knowledge';

export type AdminConfigTab = {
  id: AdminConfigTabId;
  label: string;
  path: string;
};

export type AdminConfigFilters = {
  keyword: string;
  organization: string;
  status: string;
  date: string;
};

export const adminConfigTabs: AdminConfigTab[] = [
  { id: 'overview', label: '配置总览', path: '/admin-config?tab=overview' },
  { id: 'role-packages', label: '岗位权限包', path: '/admin-config?tab=role-packages' },
  { id: 'knowledge', label: '知识库管理', path: '/admin-config?tab=knowledge' },
];

export function resolveAdminConfigTab(search: string): AdminConfigTabId {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  if (tab === 'knowledge') return 'knowledge';
  if (adminConfigTabs.some((item) => item.id === tab)) return tab as AdminConfigTabId;
  return 'overview';
}

export function getTodayDateInputValue(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const defaultAdminConfigFilters: AdminConfigFilters = {
  keyword: '',
  organization: '全部组织',
  status: '全部状态',
  date: getTodayDateInputValue(),
};
