import type { RouteMatch } from '../routeKit.ts';
import {
  getManagerFeedback,
  updateManagerFeedbackAction
} from '../services/managerService.ts';

export const managerRoutes: Record<string, RouteMatch[]> = {
  GET: [
    {
      pattern: /^\/api\/manager\/feedback\/([^/]+)$/,
      handler: getManagerFeedback,
    }
  ],
  POST: [

  ],
  PATCH: [
    {
      pattern: /^\/api\/manager\/feedback\/([^/]+)\/action$/,
      handler: updateManagerFeedbackAction,
    }
  ],
};
