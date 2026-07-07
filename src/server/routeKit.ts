import http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { SQLInputValue } from 'node:sqlite';

import { boolFromDb, boolToDb, nowIso } from './db.ts';
import type { Database } from './db.ts';
import { badRequest } from './errors.ts';
import type { ApiErrorCode } from './errors.ts';

export { boolToDb, nowIso };

export type ApiContext = {
  db: Database;
  method: string;
  pathname: string;
  request: http.IncomingMessage;
  response: http.ServerResponse;
};

export type ApiResult = {
  status?: number;
  data?: unknown;
  error?: string;
  errorCode?: ApiErrorCode;
  handled?: boolean;
};

export type RouteMatch = {
  pattern: RegExp;
  handler: (context: ApiContext, match: RegExpMatchArray) => Promise<ApiResult> | ApiResult;
};

export function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function normalizeRow<T extends Record<string, unknown>>(row: T | undefined): Record<string, unknown> | undefined {
  if (!row) return undefined;
  const next: Record<string, unknown> = { ...row };
  for (const key of ['sensitive', 'enabled', 'required', 'requiresText', 'd1GuideCompleted', 'permissionPackageViewed', 'weeklyFeedbackSubmitted', 'managerViewedFeedback', 'isAnonymous', 'includedInReview', 'visibleToManager', 'managerViewed']) {
    if (key in next) next[key] = boolFromDb(next[key]);
  }
  if ('commonWaitingReasons' in next) next.commonWaitingReasons = parseJsonArray(next.commonWaitingReasons);
  if ('expectedActionKeys' in next) next.expectedActionKeys = parseJsonArray(next.expectedActionKeys);
  return next;
}

export function normalizeRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => normalizeRow(row)!);
}

export async function readBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw badRequest('Invalid JSON body', 'INVALID_JSON');
  }
}

export function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`${key} is required`);
  }
  return value.trim();
}

export function stringArray(body: Record<string, unknown>, key: string): string[] {
  const value = body[key];
  if (!Array.isArray(value)) throw badRequest(`${key} is required`);
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim());
}

export function sqlValue(value: unknown): SQLInputValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'boolean') return boolToDb(value);
  return String(value);
}

export function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function validIsoNow(value: unknown): string {
  if (typeof value !== 'string') return nowIso();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest('now is invalid');
  return date.toISOString();
}

export function createdId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
