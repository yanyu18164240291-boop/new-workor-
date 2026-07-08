import type { D1GuideConfigItem } from '../../api.ts';
import { isAllowedPageRoutePath, isValidExternalUrl } from '../../../shared/pageRoutesContract.ts';

export function validateD1GuideDraft(draft: Partial<D1GuideConfigItem> & { actionKey: string; enabled: boolean }): string {
  if (!draft.title?.trim()) return '标题不能为空';
  if (!draft.description?.trim()) return '描述不能为空';
  if (!draft.label?.trim()) return '展示按钮文案不能为空';
  if (!draft.ownerName?.trim()) return 'Owner 不能为空';
  const taskType = draft.taskType ?? draft.actionKey;

  if (draft.enabled && taskType === 'join_group') {
    if (!draft.targetGroupName?.trim()) return '飞书部门群名称不能为空';
    if (!draft.applyUrl?.trim() && !draft.resourceLinks?.some((link) => link.url?.trim())) return '至少配置一个真实进群链接';
  }

  if (draft.enabled && taskType === 'employee_guide') {
    if (!draft.documentTitle?.trim()) return '指南册标题不能为空';
    if (!draft.documentUrl?.trim()) return '指南册链接不能为空';
  }

  if (taskType === 'join_group' && draft.applyUrl?.trim() && !isValidExternalUrl(draft.applyUrl, ['http:', 'https:'])) {
    return '真实进群链接必须是 HTTP/HTTPS URL';
  }
  if (taskType === 'join_group' && draft.resourceLinks?.some((link) => link.url?.trim() && !isValidExternalUrl(link.url, ['http:', 'https:']))) {
    return '进群资源列表中的链接必须是 HTTP/HTTPS URL';
  }

  if (taskType === 'employee_guide' && draft.documentUrl?.trim() && !isValidExternalUrl(draft.documentUrl, ['http:', 'https:'])) {
    return '指南册链接必须是 HTTP/HTTPS URL';
  }

  if (taskType === 'permission_package') {
    const routePath = draft.routePath?.trim() ?? '';
    if (!routePath) return '站内路由不能为空';
    if (!isAllowedPageRoutePath(routePath)) return '站内路由不属于 12 个合法页面映射';
    if (routePath !== '/permissions') return '岗位权限包站内路由固定为 /permissions';
  }

  return '';
}
