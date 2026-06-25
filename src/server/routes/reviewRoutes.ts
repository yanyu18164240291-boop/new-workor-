import type { RouteMatch } from '../routeKit.ts';
import {
  getReviewMetrics
} from '../services/reviewService.ts';

export const reviewRoutes: Record<string, RouteMatch[]> = {
  GET: [
    {
      pattern: /^\/api\/review\/metrics$/,
      handler: getReviewMetrics,
    }
  ],
  POST: [

  ],
  PATCH: [

  ],
};
