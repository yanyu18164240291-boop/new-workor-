import { randomBytes } from 'node:crypto';

import { badRequest } from '../errors.ts';
import type { ApiContext, ApiResult } from '../routeKit.ts';

const sessionCookieName = 'haina_feishu_session';
const sessionMaxAgeSeconds = 8 * 60 * 60;
const states = new Map<string, { returnTo: string; expiresAt: number }>();
const sessions = new Map<string, { user: FeishuUser; expiresAt: number }>();

type FeishuAuthConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  testNewcomerId: string;
};

type FeishuUser = {
  openId: string;
  unionId?: string;
  userId?: string;
  name: string;
  email?: string;
  mobile?: string;
  avatarUrl?: string;
  newcomerId: string;
};

type FeishuApiPayload<T> = {
  code?: number;
  msg?: string;
  data?: T;
  app_access_token?: string;
  expire?: number;
};

function randomToken(): string {
  return randomBytes(24).toString('base64url');
}

function authConfig(): FeishuAuthConfig | undefined {
  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  const redirectUri = process.env.FEISHU_REDIRECT_URI?.trim();
  if (!appId || !appSecret || !redirectUri) return undefined;
  return {
    appId,
    appSecret,
    redirectUri,
    testNewcomerId: process.env.FEISHU_TEST_NEWCOMER_ID?.trim() || 'newcomer-yanyu',
  };
}

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/api/auth/')) return '/';
  return value;
}

function parseCookies(cookieHeader: string | string[] | undefined): Record<string, string> {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader ?? '';
  return Object.fromEntries(
    header
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.indexOf('=');
        if (separator < 0) return [item, ''];
        return [item.slice(0, separator), decodeURIComponent(item.slice(separator + 1))];
      }),
  );
}

function currentSession(context: ApiContext): { user: FeishuUser } | undefined {
  const token = parseCookies(context.request.headers.cookie)[sessionCookieName];
  if (!token) return undefined;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return undefined;
  }
  return { user: session.user };
}

function sessionCookie(token: string, config: FeishuAuthConfig): string {
  const secure = config.redirectUri.startsWith('https://') ? '; Secure' : '';
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${secure}`;
}

function clearSessionCookie(): string {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function writeRedirect(context: ApiContext, location: string, cookies?: string[]): ApiResult {
  if (cookies?.length) context.response.setHeader('set-cookie', cookies);
  context.response.writeHead(302, { location });
  context.response.end();
  return { handled: true };
}

async function feishuPost<T>(url: string, body: Record<string, unknown>, token?: string): Promise<FeishuApiPayload<T>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return (await response.json()) as FeishuApiPayload<T>;
}

async function getAppAccessToken(config: FeishuAuthConfig): Promise<string> {
  const payload = await feishuPost<never>('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal', {
    app_id: config.appId,
    app_secret: config.appSecret,
  });
  if (payload.code !== 0 || !payload.app_access_token) {
    throw badRequest(`Feishu app token failed: ${payload.msg ?? 'unknown error'}`);
  }
  return payload.app_access_token;
}

async function getUserAccessToken(config: FeishuAuthConfig, code: string): Promise<string> {
  const appAccessToken = await getAppAccessToken(config);
  const payload = await feishuPost<{ access_token?: string }>(
    'https://open.feishu.cn/open-apis/authen/v2/oauth/token',
    {
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    },
    appAccessToken,
  );
  const accessToken = payload.data?.access_token;
  if (payload.code !== 0 || !accessToken) {
    throw badRequest(`Feishu user token failed: ${payload.msg ?? 'unknown error'}`);
  }
  return accessToken;
}

async function getFeishuUser(config: FeishuAuthConfig, userAccessToken: string): Promise<FeishuUser> {
  const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
    headers: { authorization: `Bearer ${userAccessToken}` },
  });
  const payload = (await response.json()) as FeishuApiPayload<{
    open_id?: string;
    union_id?: string;
    user_id?: string;
    name?: string;
    en_name?: string;
    email?: string;
    mobile?: string;
    avatar_url?: string;
  }>;
  if (payload.code !== 0 || !payload.data?.open_id) {
    throw badRequest(`Feishu user info failed: ${payload.msg ?? 'unknown error'}`);
  }
  return {
    openId: payload.data.open_id,
    unionId: payload.data.union_id,
    userId: payload.data.user_id,
    name: payload.data.name || payload.data.en_name || 'Feishu User',
    email: payload.data.email,
    mobile: payload.data.mobile,
    avatarUrl: payload.data.avatar_url,
    newcomerId: config.testNewcomerId,
  };
}

export function getFeishuAuthSession(context: ApiContext): ApiResult {
  const config = authConfig();
  if (!config) {
    return { data: { enabled: false, authenticated: true, user: null } };
  }
  const session = currentSession(context);
  const returnTo = safeReturnTo(new URL(context.request.url ?? '/', 'http://127.0.0.1').searchParams.get('returnTo'));
  return {
    data: {
      enabled: true,
      authenticated: Boolean(session),
      user: session?.user ?? null,
      loginUrl: `/api/auth/feishu/start?returnTo=${encodeURIComponent(returnTo)}`,
    },
  };
}

export function startFeishuAuth(context: ApiContext): ApiResult {
  const config = authConfig();
  if (!config) throw badRequest('Feishu auth is not configured');
  const url = new URL(context.request.url ?? '/', 'http://127.0.0.1');
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
  const state = randomToken();
  states.set(state, { returnTo, expiresAt: Date.now() + 10 * 60 * 1000 });
  const authorize = new URL('https://open.feishu.cn/open-apis/authen/v1/index');
  authorize.searchParams.set('app_id', config.appId);
  authorize.searchParams.set('redirect_uri', config.redirectUri);
  authorize.searchParams.set('state', state);
  return writeRedirect(context, authorize.toString());
}

export async function handleFeishuAuthCallback(context: ApiContext): Promise<ApiResult> {
  const config = authConfig();
  if (!config) throw badRequest('Feishu auth is not configured');
  const url = new URL(context.request.url ?? '/', 'http://127.0.0.1');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) throw badRequest('Feishu auth callback is missing code or state');
  const storedState = states.get(state);
  states.delete(state);
  if (!storedState || storedState.expiresAt < Date.now()) throw badRequest('Feishu auth state is invalid or expired');

  const userAccessToken = await getUserAccessToken(config, code);
  const user = await getFeishuUser(config, userAccessToken);
  const sessionToken = randomToken();
  sessions.set(sessionToken, { user, expiresAt: Date.now() + sessionMaxAgeSeconds * 1000 });
  return writeRedirect(context, storedState.returnTo, [sessionCookie(sessionToken, config)]);
}

export function logoutFeishuAuth(context: ApiContext): ApiResult {
  const token = parseCookies(context.request.headers.cookie)[sessionCookieName];
  if (token) sessions.delete(token);
  context.response.setHeader('set-cookie', clearSessionCookie());
  return { status: 200, data: { loggedOut: true } };
}
