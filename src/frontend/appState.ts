import { useEffect, useRef, useState } from 'react';

import { api, formatApiErrorMessage } from './api.ts';
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

const newcomerPageNos = new Set(['01', '03', '04', '05']);
const dashboardDataCache = new Map<string, DashboardData>();

function getDashboardCacheKey(pageNo: string, params: Record<string, string>, previewRoleId?: string) {
  if (newcomerPageNos.has(pageNo)) return `newcomer:${previewRoleId ?? 'default'}`;
  if (pageNo === '08') return 'admin-config';
  return `page:${pageNo}:${JSON.stringify(params)}`;
}

export function resolveNewcomerSelectedRoleId(
  newcomerRoleId: string,
  enabledRoles: Array<{ id: string }>,
  previewRoleId?: string,
): string {
  if (previewRoleId && enabledRoles.some((role) => role.id === previewRoleId)) return previewRoleId;
  if (enabledRoles.some((role) => role.id === newcomerRoleId)) return newcomerRoleId;
  return enabledRoles[0]?.id ?? newcomerRoleId;
}

async function loadNewcomerSurfaceData(previewRoleId?: string): Promise<DashboardData> {
  const [newcomer, roles, authSession] = await Promise.all([api.getNewcomer(DEMO_NEWCOMER_ID), api.getRoles(), api.getAuthSession()]);
  const enabledRoles = roles.filter((role) => role.enabled !== false);
  const selectedRoleId = resolveNewcomerSelectedRoleId(newcomer.roleId, enabledRoles, previewRoleId);
  const [permissionPackage, progress, followUps] = await Promise.all([
    api.getPermissionPackage(selectedRoleId),
    api.getPermissionProgress(newcomer.id),
    api.getFollowUpTasks(newcomer.id),
  ]);
  return {
    newcomer: { ...newcomer, roleId: selectedRoleId },
    roles: enabledRoles,
    selectedRoleId,
    authSession,
    package: permissionPackage,
    progress,
    followUps,
  };
}

async function loadAdminConfigSurfaceData(): Promise<DashboardData> {
  const [admin, knowledgeDocs, authSession] = await Promise.all([
    api.getAdminConfig(),
    api.getKnowledgeDocs(),
    api.getAuthSession(),
  ]);
  return {
    admin,
    knowledgeDocs,
    authSession,
  };
}

async function loadDashboardDataForPage(pageNo: string, params: Record<string, string>, previewRoleId?: string): Promise<DashboardData> {
  if (pageNo === '08') return loadAdminConfigSurfaceData();
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
