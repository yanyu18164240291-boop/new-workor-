import type { ApiContext, ApiResult, RouteMatch } from './routeKit.ts';
import { forbidden, toApiError } from './errors.ts';
import { adminRoutes } from './routes/adminRoutes.ts';
import { authRoutes } from './routes/authRoutes.ts';
import { isFeishuAdminSession } from './services/feishuAuthService.ts';
import { managerRoutes } from './routes/managerRoutes.ts';
import { newcomerRoutes } from './routes/newcomerRoutes.ts';
import { reviewRoutes } from './routes/reviewRoutes.ts';

function mergeRoutes(...groups: Array<Record<string, RouteMatch[]>>): Record<string, RouteMatch[]> {
  const merged: Record<string, RouteMatch[]> = {};
  for (const group of groups) {
    for (const [method, matches] of Object.entries(group)) {
      merged[method] = [...(merged[method] ?? []), ...matches];
    }
  }
  return merged;
}

const routes = mergeRoutes(authRoutes, newcomerRoutes, adminRoutes, managerRoutes, reviewRoutes);

function assertAdminRouteGuard(context: ApiContext): void {
  if (!context.pathname.startsWith('/api/admin/') && !context.pathname.startsWith('/api/admin-config/')) return;
  const role = String(context.request.headers['x-haina-role'] ?? '').trim().toLowerCase();
  const actor = String(context.request.headers['x-haina-actor'] ?? '').trim();
  if (isFeishuAdminSession(context)) return;
  if (role !== 'admin' || actor !== 'demo-admin') {
    throw forbidden('Admin role is required for admin API access');
  }
}

function assertManagerRouteGuard(context: ApiContext): void {
  if (!context.pathname.startsWith('/api/manager/')) return;
  const role = String(context.request.headers['x-haina-role'] ?? '').trim().toLowerCase();
  const actor = String(context.request.headers['x-haina-actor'] ?? '').trim();
  if (role !== 'manager' || !['demo-manager', 'demo-other-manager'].includes(actor)) {
    throw forbidden('Manager role is required for manager API access');
  }
}

export async function handleApiRequest(context: ApiContext): Promise<ApiResult> {
  const matches = routes[context.method] ?? [];
  for (const route of matches) {
    const match = context.pathname.match(route.pattern);
    if (match) {
      try {
        assertAdminRouteGuard(context);
        assertManagerRouteGuard(context);
        return await route.handler(context, match);
      } catch (error) {
        const apiError = toApiError(error);
        return { status: apiError.status, error: apiError.message, errorCode: apiError.code };
      }
    }
  }
  return { status: 404, error: 'Route not found' };
}
