import { useEffect, useState } from 'react';

import { api, formatApiErrorMessage } from './api.ts';
import type { DashboardData } from './dashboardData.ts';
import { DEMO_NEWCOMER_ID, DEMO_SECONDARY_NEWCOMER_ID } from './demoConfig.ts';

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

async function loadNewcomerSurfaceData(previewRoleId?: string): Promise<DashboardData> {
  const [newcomer, roles] = await Promise.all([api.getNewcomer(DEMO_NEWCOMER_ID), api.getRoles()]);
  const enabledRoles = roles.filter((role) => role.enabled !== false);
  const selectedRoleId =
    previewRoleId && enabledRoles.some((role) => role.id === previewRoleId)
      ? previewRoleId
      : enabledRoles.some((role) => role.id === newcomer.roleId)
        ? newcomer.roleId
        : enabledRoles[0]?.id ?? newcomer.roleId;
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

async function loadManagerSurfaceData(): Promise<DashboardData> {
  const [roles, newcomer, secondaryNewcomer] = await Promise.all([
    api.getRoles(),
    api.getNewcomer(DEMO_NEWCOMER_ID),
    api.getNewcomer(DEMO_SECONDARY_NEWCOMER_ID),
  ]);
  const enabledRoleIds = new Set(roles.filter((role) => role.enabled !== false).map((role) => role.id));
  const newcomers = [newcomer, secondaryNewcomer].filter((item) => enabledRoleIds.has(item.roleId));
  const weekly = await api.getWeeklyFeedback(newcomer.id);
  return {
    newcomer,
    newcomers,
    roles,
    weekly,
  };
}

async function loadDashboardDataForPage(pageNo: string, previewRoleId?: string): Promise<DashboardData> {
  if (pageNo === '08') return loadAdminConfigSurfaceData();
  if (pageNo === '09') return loadReviewSurfaceData();
  if (managerPageNos.has(pageNo)) return loadManagerSurfaceData();
  if (newcomerPageNos.has(pageNo)) return loadNewcomerSurfaceData(previewRoleId);
  return {};
}

export function useDashboardData(pageNo: string) {
  const [data, setData] = useState<DashboardData>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [previewRoleId, setPreviewRoleId] = useState<string | undefined>();

  async function load(nextPreviewRoleId = previewRoleId) {
    try {
      setStatus('loading');
      setError('');
      const nextData = nextPreviewRoleId
        ? await loadDashboardDataForPage(pageNo, nextPreviewRoleId)
        : await loadDashboardDataForPage(pageNo);
      setData(nextData);
      setStatus('ready');
    } catch (caught) {
      setError(formatApiErrorMessage(caught));
      setStatus('error');
    }
  }

  async function selectPreviewRole(roleId: string) {
    setPreviewRoleId(roleId);
    await load(roleId);
  }

  useEffect(() => {
    load();
  }, [pageNo]);

  return { data, status, error, reload: () => load(previewRoleId), selectPreviewRole };
}
