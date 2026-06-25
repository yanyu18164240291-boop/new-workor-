import type { ApiContext, ApiResult, RouteMatch } from './routeKit.ts';
import { adminRoutes } from './routes/adminRoutes.ts';
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

const routes = mergeRoutes(newcomerRoutes, adminRoutes, managerRoutes, reviewRoutes);

export async function handleApiRequest(context: ApiContext): Promise<ApiResult> {
  const matches = routes[context.method] ?? [];
  for (const route of matches) {
    const match = context.pathname.match(route.pattern);
    if (match) return route.handler(context, match);
  }
  return { status: 404, error: 'Route not found' };
}
