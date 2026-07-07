import type { RouteMatch } from '../routeKit.ts';
import {
  getFeishuAuthSession,
  handleFeishuAuthCallback,
  logoutFeishuAuth,
  startFeishuAuth,
} from '../services/feishuAuthService.ts';

export const authRoutes: Record<string, RouteMatch[]> = {
  GET: [
    {
      pattern: /^\/api\/auth\/session$/,
      handler: getFeishuAuthSession,
    },
    {
      pattern: /^\/api\/auth\/feishu\/start$/,
      handler: startFeishuAuth,
    },
    {
      pattern: /^\/api\/auth\/feishu\/callback$/,
      handler: handleFeishuAuthCallback,
    },
  ],
  POST: [
    {
      pattern: /^\/api\/auth\/logout$/,
      handler: logoutFeishuAuth,
    },
  ],
  PATCH: [],
};
