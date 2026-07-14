export type PageRoute = {
  pageNo: string;
  path: string;
  title: string;
  shortTitle: string;
  owner: 'newcomer' | 'admin';
  purpose: string;
  samplePath?: string;
};

export type BottomNavItem = {
  path: string;
  label: string;
  icon: 'bar' | 'grid' | 'home' | 'inbox' | 'message' | 'shield' | 'user' | 'wrench';
  pages: string[];
};

export type ShellKind = 'mobile' | 'desktop';

export const pageRoutes: PageRoute[] = [
  {
    pageNo: '01',
    path: '/',
    title: '新人首页 / 智能体主入口',
    shortTitle: '首页',
    owner: 'newcomer',
    purpose: '提供权限问答、权限状态和申请入口。',
  },
  {
    pageNo: '03',
    path: '/permissions',
    title: '岗位权限包',
    shortTitle: '权限包',
    owner: 'newcomer',
    purpose: '展示岗位必需和可选权限，并从真实后端读取权限包配置。',
  },
  {
    pageNo: '04',
    path: '/permission-detail/:id',
    samplePath: '/permission-detail/perm-oa',
    title: '权限详情 / 进度登记',
    shortTitle: '权限详情',
    owner: 'newcomer',
    purpose: '查看单个权限的申请入口、审批人、理由模板和“我已提交”登记入口。',
  },
  {
    pageNo: '05',
    path: '/follow-up/:taskId',
    samplePath: '/follow-up/follow-up-yanyu-oa',
    title: '4 小时回访 / 未完成处理',
    shortTitle: '4 小时回访',
    owner: 'newcomer',
    purpose: '在权限提交 4 小时后跟进未完成原因和后续处理状态。',
  },
  {
    pageNo: '08',
    path: '/admin-config',
    title: '后台配置维护台',
    shortTitle: '配置台',
    owner: 'admin',
    purpose: '维护权限包和知识库等真实配置数据。',
  },
];

export function toConcretePath(route: PageRoute): string {
  return route.samplePath ?? route.path;
}

export function getOwnerHomePath(owner: PageRoute['owner']): string {
  if (owner === 'admin') return '/admin-config';
  return '/';
}

export function getShellKind(route: PageRoute): ShellKind {
  return route.owner === 'admin' ? 'desktop' : 'mobile';
}

export function getHomeQuickQuestions(): string[] {
  return ['ChatGPT账号怎么申请？', 'OA系统怎么登录？', '我今天应该先做什么？'];
}

export function getBottomNavItems(currentPage: string): BottomNavItem[] {
  const page = pageRoutes.find((route) => route.pageNo === currentPage);

  if (page?.owner === 'admin') {
    return [
      { path: '/admin-config', label: '配置', icon: 'wrench', pages: ['08'] },
      { path: '/admin-config?tab=knowledge', label: '知识库', icon: 'grid', pages: [] },
    ];
  }

  return [
    { path: '/', label: '首页', icon: 'home', pages: ['01'] },
    { path: '/permissions', label: '权限申请', icon: 'shield', pages: ['03', '04', '05'] },
  ];
}

export function matchRoute(pathname: string): { route: PageRoute; params: Record<string, string> } {
  for (const route of pageRoutes) {
    const names: string[] = [];
    const pattern = route.path
      .replace(/:[^/]+/g, (segment) => {
        names.push(segment.slice(1));
        return '([^/]+)';
      })
      .replace(/\//g, '\\/');
    const match = pathname.match(new RegExp(`^${pattern}$`));
    if (match) {
      return {
        route,
        params: Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(match[index + 1])])),
      };
    }
  }
  return { route: pageRoutes[0], params: {} };
}
