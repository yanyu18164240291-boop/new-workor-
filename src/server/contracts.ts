import { badRequest } from './errors.ts';

export const permissionProgressStatuses = ['pending', 'submitted', 'completed', 'rejected'] as const;
export type PermissionProgressStatus = (typeof permissionProgressStatuses)[number];

export const taskStatuses = ['pending', 'completed'] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const followUpStatuses = ['pending', 'completed', 'closed'] as const;
export type FollowUpStatus = (typeof followUpStatuses)[number];

export const anonymousFeedbackStatuses = ['open', 'in_progress', 'resolved', 'archived'] as const;
export type AnonymousFeedbackStatus = (typeof anonymousFeedbackStatuses)[number];

export const managerActionStatuses = ['unread', 'pending_follow_up', 'viewed', 'followed_up', 'closed'] as const;
export type ManagerActionStatus = (typeof managerActionStatuses)[number];

export type PermissionType = 'required' | 'optional';

export type WeeklyAnswerInput = {
  questionId: string;
  selectedOptionIds?: string[];
  textValue?: string;
};

export function parsePermissionProgressStatus(value: unknown, fallback: PermissionProgressStatus = 'submitted'): PermissionProgressStatus {
  const status = typeof value === 'string' ? value : fallback;
  if (!isOneOf(status, permissionProgressStatuses)) throw badRequest('status is invalid');
  return status;
}

export function parseTaskStatus(value: unknown, fallback: TaskStatus = 'completed'): TaskStatus {
  const status = typeof value === 'string' ? value : fallback;
  if (!isOneOf(status, taskStatuses)) throw badRequest('status is invalid');
  return status;
}

export function parseFollowUpStatus(value: unknown, fallback: FollowUpStatus = 'pending'): FollowUpStatus {
  const status = typeof value === 'string' ? value : fallback;
  if (!isOneOf(status, followUpStatuses)) throw badRequest('status is invalid');
  return status;
}

export function parseAnonymousFeedbackStatus(value: unknown, fallback: AnonymousFeedbackStatus): AnonymousFeedbackStatus {
  const status = typeof value === 'string' ? value : fallback;
  if (!isOneOf(status, anonymousFeedbackStatuses)) throw badRequest('status is invalid');
  return status;
}

export function parseManagerActionStatus(value: unknown, fallback: ManagerActionStatus): ManagerActionStatus {
  const status = typeof value === 'string' ? value : fallback;
  if (!isOneOf(status, managerActionStatuses)) throw badRequest('managerActionStatus is invalid');
  return status;
}

export function isSubmittedPermissionStatus(status: PermissionProgressStatus): boolean {
  return status === 'submitted' || status === 'completed';
}

export function isPermissionType(value: unknown): value is PermissionType {
  return value === 'required' || value === 'optional';
}

export function parseWeeklyAnswerInputs(value: unknown): WeeklyAnswerInput[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isWeeklyAnswerInput);
}

function isWeeklyAnswerInput(value: unknown): value is WeeklyAnswerInput {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (typeof item.questionId !== 'string' || item.questionId.trim() === '') return false;
  if ('selectedOptionIds' in item && !Array.isArray(item.selectedOptionIds)) return false;
  if (Array.isArray(item.selectedOptionIds) && !item.selectedOptionIds.every((option) => typeof option === 'string')) return false;
  if ('textValue' in item && typeof item.textValue !== 'string') return false;
  return true;
}

function isOneOf<const T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return allowed.includes(value);
}
