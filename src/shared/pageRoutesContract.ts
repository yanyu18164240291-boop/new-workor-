export const activePageRoutePaths = [
  '/',
  '/permissions',
  '/permission-detail/:id',
  '/follow-up/:taskId',
  '/admin-config',
] as const;

export const allowedPageRoutePatterns = activePageRoutePaths;

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[^/]+/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

export function isAllowedPageRoutePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return false;
  const pathname = trimmed.split('?')[0];
  return allowedPageRoutePatterns.some((pattern) => patternToRegExp(pattern).test(pathname));
}

export function isValidExternalUrl(value: string, allowedProtocols = ['mock-feishu:', 'http:', 'https:']): boolean {
  try {
    const parsed = new URL(value.trim());
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}
