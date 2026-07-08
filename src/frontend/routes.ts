import { DEMO_NEWCOMER_ID, DEMO_WEEKLY_FEEDBACK_ID } from './demoConfig.ts';

export type PageRoute = {
  pageNo: string;
  path: string;
  title: string;
  shortTitle: string;
  owner: 'newcomer' | 'admin' | 'manager';
  purpose: string;
  samplePath?: string;
};

export type BottomNavItem = {
  path: string;
  label: string;
  icon: 'bar' | 'grid' | 'home' | 'inbox' | 'message' | 'shield' | 'user' | 'wrench';
  pages: string[];
};

export type HomeShortcutItem = {
  path: string;
  label: string;
  desc: string;
  icon: 'book' | 'message' | 'shield' | 'sparkles' | 'user';
  tone: 'blue' | 'success' | 'warning' | 'ai';
};

export type ShellKind = 'mobile' | 'desktop';

export const pageRoutes: PageRoute[] = [
  {
    pageNo: '01',
    path: '/',
    title: '新人首页 / 智能体主入口',
    shortTitle: '首页',
    owner: 'newcomer',
    purpose: '展示新人今日关键任务、权限状态和反馈入口。',
  },
  {
    pageNo: '02',
    path: '/d1',
    title: 'D1 到达引导包',
    shortTitle: 'D1 引导',
    owner: 'newcomer',
    purpose: '承载到达公司第一天的行动清单和 Bot 卡片引导。',
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
    pageNo: '06',
    path: '/weekly-feedback',
    title: '新人首周反馈填写',
    shortTitle: '首周反馈',
    owner: 'newcomer',
    purpose: '新人实名填写首周反馈，供管理者查看和跟进。',
  },
  {
    pageNo: '07',
    path: '/anonymous-feedback',
    title: '匿名反馈',
    shortTitle: '匿名反馈',
    owner: 'newcomer',
    purpose: '收集流程、内容和产品体验匿名反馈，不向管理者暴露原文。',
  },
  {
    pageNo: '08',
    path: '/admin-config',
    title: '后台配置维护台',
    shortTitle: '配置台',
    owner: 'admin',
    purpose: '维护权限包、知识库和匿名反馈池等真实配置数据。',
  },
  {
    pageNo: '09',
    path: '/review',
    title: 'V1 灰度试点复盘',
    shortTitle: '试点复盘',
    owner: 'admin',
    purpose: '汇总试点指标、反馈和知识库命中情况。',
  },
  {
    pageNo: '10',
    path: '/manager',
    title: '管理者首页 / 今日新员工概览',
    shortTitle: '入职管理',
    owner: 'manager',
    purpose: '帮助管理者查看今日新人、权限进度和待跟进事项。',
  },
  {
    pageNo: '11',
    path: '/manager/newcomer/:id',
    samplePath: `/manager/newcomer/${DEMO_NEWCOMER_ID}`,
    title: '新人首周跟踪详情',
    shortTitle: '新人详情',
    owner: 'manager',
    purpose: '展示单个新人首周进展，支持管理者跟进而非评价排名。',
  },
  {
    pageNo: '12',
    path: '/manager/feedback/:id',
    samplePath: `/manager/feedback/${DEMO_WEEKLY_FEEDBACK_ID}`,
    title: '管理者视角 / 新人首周反馈',
    shortTitle: '反馈查看',
    owner: 'manager',
    purpose: '只读查看新人实名首周反馈，并登记管理者跟进行动。',
  },
];

export function toConcretePath(route: PageRoute): string {
  return route.samplePath ?? route.path;
}

export function getOwnerHomePath(owner: PageRoute['owner']): string {
  if (owner === 'admin') return '/admin-config';
  if (owner === 'manager') return '/manager';
  return '/';
}

export function getShellKind(route: PageRoute): ShellKind {
  return route.owner === 'admin' ? 'desktop' : 'mobile';
}

export function getHomeShortcutItems(): HomeShortcutItem[] {
  return [
    { path: '/d1', label: 'D1引导', desc: 'D1引导，一步步完成入职', icon: 'book', tone: 'blue' },
    { path: '/permissions', label: '权限申请', desc: '岗位权限包、进度登记', icon: 'shield', tone: 'success' },
    { path: '/weekly-feedback', label: '首周反馈', desc: '写给管理者的支持诉求', icon: 'user', tone: 'ai' },
    { path: '/anonymous-feedback', label: '匿名反馈', desc: '匿名反馈、流程优化', icon: 'message', tone: 'warning' },
  ];
}

export function getHomeQuickQuestions(): string[] {
  return ['ChatGPT账号怎么申请？', 'OA系统怎么登录？', '我今天应该先做什么？'];
}

export function getBottomNavItems(currentPage: string): BottomNavItem[] {
  const page = pageRoutes.find((route) => route.pageNo === currentPage);

  if (page?.owner === 'manager') {
    return [
      { path: '/manager', label: '总览', icon: 'grid', pages: ['10'] },
      { path: `/manager/newcomer/${DEMO_NEWCOMER_ID}`, label: '新人', icon: 'user', pages: ['11'] },
    ];
  }

  if (page?.owner === 'admin') {
    return [
      { path: '/admin-config', label: '配置', icon: 'wrench', pages: ['08'] },
      { path: '/admin-config?tab=knowledge', label: '知识库', icon: 'grid', pages: [] },
      { path: '/admin-config?tab=feedback', label: '反馈池', icon: 'inbox', pages: [] },
      { path: '/review', label: '复盘', icon: 'bar', pages: ['09'] },
    ];
  }

  return [
    { path: '/', label: '首页', icon: 'home', pages: ['01'] },
    { path: '/d1', label: 'D1引导', icon: 'grid', pages: ['02'] },
    { path: '/permissions', label: '权限申请', icon: 'shield', pages: ['03', '04', '05'] },
    { path: '/weekly-feedback', label: '首周反馈', icon: 'user', pages: ['06'] },
    { path: '/anonymous-feedback', label: '匿名反馈', icon: 'message', pages: ['07'] },
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
