import { useEffect, useState } from 'react';

import { api } from './api.ts';
import type { DashboardData } from './dashboardData.ts';
import { DEMO_NEWCOMER_ID } from './demoConfig.ts';

export function usePathname() {
  const [location, setLocation] = useState(`${window.location.pathname}${window.location.search}`);

  useEffect(() => {
    const onPop = () => setLocation(`${window.location.pathname}${window.location.search}`);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setLocation(`${window.location.pathname}${window.location.search}`);
  };

  return { pathname: location.split('?')[0], search: location.includes('?') ? location.split('?')[1] : '', navigate };
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  async function load() {
    try {
      setStatus('loading');
      const newcomer = await api.getNewcomer(DEMO_NEWCOMER_ID);
      const [permissionPackage, progress, followUps, d1GuideConfig, admin, knowledgeDocs, metrics, weeklyConfig, weeklyAnalysis, anonymousConfig, weekly, anonymous] = await Promise.all([
        api.getPermissionPackage(newcomer.roleId),
        api.getPermissionProgress(newcomer.id),
        api.getFollowUpTasks(newcomer.id),
        api.getD1GuideConfig(),
        api.getAdminConfig(),
        api.getKnowledgeDocs(),
        api.getReviewMetrics(),
        api.getWeeklyFeedbackConfig(),
        api.getWeeklyFeedbackAnalysis(),
        api.getAnonymousFeedbackConfig(),
        api.getWeeklyFeedback(newcomer.id),
        api.getAnonymousFeedbacks(),
      ]);
      setData({
        newcomer,
        package: permissionPackage,
        progress,
        followUps,
        d1GuideConfig,
        admin,
        knowledgeDocs,
        metrics,
        weeklyConfig,
        weeklyAnalysis,
        anonymousConfig,
        weekly,
        anonymous,
      });
      setStatus('ready');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '后端数据加载失败');
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { data, status, error, reload: load };
}
