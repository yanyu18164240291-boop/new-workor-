export const currentAdminUser = {
  name: 'demo-admin',
  role: '后台管理员',
} as const;

export type AdminConfigTabId =
  | 'overview'
  | 'role-packages'
  | 'd1-guide'
  | 'weekly-feedback'
  | 'anonymous-config'
  | 'knowledge'
  | 'feedback-pool';

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
  { id: 'd1-guide', label: 'D1 引导配置', path: '/admin-config?tab=d1-guide' },
  { id: 'weekly-feedback', label: '首周反馈表', path: '/admin-config?tab=weekly-feedback' },
  { id: 'anonymous-config', label: '匿名反馈配置', path: '/admin-config?tab=anonymous-config' },
  { id: 'knowledge', label: '知识库管理', path: '/admin-config?tab=knowledge' },
  { id: 'feedback-pool', label: '匿名反馈池', path: '/admin-config?tab=feedback-pool' },
];

export function resolveAdminConfigTab(search: string): AdminConfigTabId {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  if (tab === 'feedback') return 'feedback-pool';
  if (tab === 'knowledge') return 'knowledge';
  if (adminConfigTabs.some((item) => item.id === tab)) return tab as AdminConfigTabId;
  return 'overview';
}

export const defaultAdminConfigFilters: AdminConfigFilters = {
  keyword: '',
  organization: '全部组织',
  status: '全部状态',
  date: '2026-06-23',
};
