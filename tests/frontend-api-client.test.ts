import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { api, ApiClientError, formatApiErrorMessage, isApiClientError } from '../src/frontend/api.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(response: Response): void {
  globalThis.fetch = async () => response;
}

describe('frontend API client', () => {
  it('unwraps successful backend data payloads', async () => {
    mockFetch(Response.json({ data: [{ id: 'role-1', name: '产品实习生', department: '协同办公', description: 'demo' }] }));

    const roles = await api.getRoles();

    assert.equal(roles[0].id, 'role-1');
  });

  it('keeps backend error code, status, path, and message', async () => {
    mockFetch(Response.json({ error: 'status is invalid', code: 'VALIDATION_ERROR' }, { status: 400 }));

    await assert.rejects(
      () => api.submitPermissionProgress('newcomer-1', 'perm-1'),
      (error) => {
        assert.equal(isApiClientError(error), true);
        const apiError = error as ApiClientError;
        assert.equal(apiError.status, 400);
        assert.equal(apiError.code, 'VALIDATION_ERROR');
        assert.equal(apiError.path, '/api/newcomers/newcomer-1/permission-progress');
        assert.equal(apiError.message, 'status is invalid');
        assert.equal(formatApiErrorMessage(apiError), 'status is invalid');
        return true;
      },
    );
  });

  it('maps network failures to a user-facing backend connection message', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed');
    };

    await assert.rejects(
      () => api.getRoles(),
      (error) => {
        assert.equal(isApiClientError(error), true);
        const apiError = error as ApiClientError;
        assert.equal(apiError.status, 0);
        assert.equal(apiError.code, 'NETWORK_ERROR');
        assert.equal(formatApiErrorMessage(apiError), '后端未连接，请确认 API 服务已启动。');
        return true;
      },
    );
  });

  it('maps invalid backend JSON responses to parse errors', async () => {
    mockFetch(new Response('not json', { status: 502 }));

    await assert.rejects(
      () => api.getRoles(),
      (error) => {
        assert.equal(isApiClientError(error), true);
        const apiError = error as ApiClientError;
        assert.equal(apiError.status, 502);
        assert.equal(apiError.code, 'PARSE_ERROR');
        return true;
      },
    );
  });
});
