import { useEffect, useRef, useState } from 'react';

import { api, formatApiErrorMessage, isApiClientError } from './api.ts';
import type { DashboardData } from './dashboardData.ts';
import { DEMO_NEWCOMER_ID, DEMO_WEEKLY_FEEDBACK_ID } from './demoConfig.ts';

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

const newcomerPageNos = new Set(['01', '02', '03', '04', '05', '06', '07']);
const managerPageNos = new Set(['10', '11', '12']);
const dashboardDataCache = new Map<string, DashboardData>();

function getDashboardCacheKey(pageNo: string, params: Record<string, string>, previewRoleId?: string) {
  if (newcomerPageNos.has(pageNo)) return `newcomer:${previewRoleId ?? 'default'}`;
  if (pageNo === '08') return 'admin-config';
  if (pageNo === '09') return 'review';
  if (managerPageNos.has(pageNo)) return `manager:${pageNo}:${JSON.stringify(params)}`;
  return `page:${pageNo}:${JSON.stringify(params)}`;
}

async function loadNewcomerSurfaceData(previewRoleId?: string): Promise<DashboardData> {
  const [newcomer, roles] = await Promise.all([api.getNewcomer(DEMO_NEWCOMER_ID), api.getRoles()]);
  const enabledRoles = roles.filter((role) => role.enabled !== false);
  const selectedRoleId =
    previewRoleId && enabledRoles.some((role) => role.id === previewRoleId) ? previewRoleId : newcomer.roleId;
  const [permissionPackage, progress, followUps, d1GuideConfig, weeklyConfig, anonymousConfig, weekly] = await Promise.all([
    api.getPermissionPackage(selectedRoleId),
    api.getPermissionProgress(newcomer.id),
    api.getFollowUpTasks(newcomer.id),
    api.getD1GuideConfig(),
    api.getWeeklyFeedbackConfig(),
    api.getAnonymousFeedbackConfig(),
    api.getWeeklyFeedback(newcomer.id),
  ]);
  return {
    newcomer: { ...newcomer, roleId: selectedRoleId },
    roles: enabledRoles,
    selectedRoleId,
    package: permissionPackage,
    progress,
    followUps,
    d1GuideConfig,
    weeklyConfig,
    anonymousConfig,
    weekly,
  };
}

async function loadAdminConfigSurfaceData(): Promise<DashboardData> {
  const [admin, adminD1GuideConfig, knowledgeDocs, metrics, weeklyAnalysis, anonymous] = await Promise.all([
    api.getAdminConfig(),
    api.getAdminD1GuideConfig(),
    api.getKnowledgeDocs(),
    api.getReviewMetrics(),
    api.getWeeklyFeedbackAnalysis(),
    api.getAnonymousFeedbacks(),
  ]);
  const adminConfig = { ...admin, d1GuideConfig: adminD1GuideConfig };
  return {
    admin: adminConfig,
    knowledgeDocs,
    metrics,
    weeklyAnalysis,
    anonymous,
    d1GuideConfig: adminD1GuideConfig,
    weeklyConfig: admin.weeklyFeedbackConfig,
    anonymousConfig: admin.anonymousFeedbackConfig,
  };
}

async function loadReviewSurfaceData(): Promise<DashboardData> {
  const newcomer = await api.getNewcomer(DEMO_NEWCOMER_ID);
  const [metrics, knowledgeDocs, anonymousConfig, weekly] = await Promise.all([
    api.getReviewMetrics(),
    api.getKnowledgeDocs(),
    api.getAnonymousFeedbackConfig(),
    api.getWeeklyFeedback(newcomer.id),
  ]);
  return {
    newcomer,
    metrics,
    knowledgeDocs,
    anonymousConfig,
    weekly,
  };
}

async function getOptionalManagerFeedback(feedbackId: string) {
  try {
    return await api.getManagerFeedback(feedbackId);
  } catch (caught) {
    if (isApiClientError(caught) && caught.code === 'NOT_FOUND') return undefined;
    throw caught;
  }
}

async function loadManagerSurfaceData(pageNo: string, params: Record<string, string>): Promise<DashboardData> {
  if (pageNo === '10') {
    const managerOverview = await api.getManagerOverview({ limit: 20, offset: 0 });
    return {
      managerOverview,
    };
  }

  if (pageNo === '12') {
    const feedbackId = params.id ?? DEMO_WEEKLY_FEEDBACK_ID;
    const weekly = await getOptionalManagerFeedback(feedbackId);
    const newcomerId = weekly?.newcomerId ?? feedbackId;
    const managerDetail = await api.getManagerNewcomerDetail(newcomerId);
    return {
      managerDetail,
      newcomer: managerDetail.newcomer,
      weekly,
    };
  }

  const newcomerId = params.id ?? DEMO_NEWCOMER_ID;
  const managerDetail = await api.getManagerNewcomerDetail(newcomerId);
  return {
    managerDetail,
    newcomer: managerDetail.newcomer,
  };
}

async function loadDashboardDataForPage(pageNo: string, params: Record<string, string>, previewRoleId?: string): Promise<DashboardData> {
  if (pageNo === '08') return loadAdminConfigSurfaceData();
  if (pageNo === '09') return loadReviewSurfaceData();
  if (managerPageNos.has(pageNo)) return loadManagerSurfaceData(pageNo, params);
  if (newcomerPageNos.has(pageNo)) return loadNewcomerSurfaceData(previewRoleId);
  return {};
}

async function ensureFeishuAuth(): Promise<boolean> {
  const session = await api.getAuthSession();
  if (!session.enabled || session.authenticated) return true;
  window.location.href = session.loginUrl ?? `/api/auth/feishu/start?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;
  return false;
}

export function useDashboardData(pageNo: string, params: Record<string, string> = {}) {
  const [data, setData] = useState<DashboardData>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [previewRoleId, setPreviewRoleId] = useState<string | undefined>();
  const loadVersionRef = useRef(0);
  const paramsKey = JSON.stringify(params);

  async function load(nextPreviewRoleId = previewRoleId) {
    const requestVersion = loadVersionRef.current + 1;
    loadVersionRef.current = requestVersion;
    const cacheKey = getDashboardCacheKey(pageNo, params, nextPreviewRoleId);
    const cachedData = dashboardDataCache.get(cacheKey);
    try {
      if (!cachedData) {
        setStatus('loading');
      } else {
        setData({ ...cachedData, __staleWhileRevalidate: true });
        setStatus('ready');
      }
      setError('');
      const authenticated = await ensureFeishuAuth();
      if (!authenticated) return;
      const nextData = nextPreviewRoleId
        ? await loadDashboardDataForPage(pageNo, params, nextPreviewRoleId)
        : await loadDashboardDataForPage(pageNo, params);
      if (loadVersionRef.current !== requestVersion) return;
      dashboardDataCache.set(cacheKey, nextData);
      setData({ ...nextData, __staleWhileRevalidate: false });
      setStatus('ready');
    } catch (caught) {
      if (loadVersionRef.current !== requestVersion) return;
      setError(formatApiErrorMessage(caught));
      setStatus(cachedData ? 'ready' : 'error');
    }
  }

  async function selectPreviewRole(roleId: string) {
    setPreviewRoleId(roleId);
    await load(roleId);
  }

  useEffect(() => {
    load();
  }, [pageNo, paramsKey]);

  return { data, status, error, reload: () => load(previewRoleId), selectPreviewRole };
}
