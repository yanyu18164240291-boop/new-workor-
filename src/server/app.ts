import http from 'node:http';

import type { Database } from './db.ts';
import { handleApiRequest } from './apiRoutes.ts';

function writeJson(response: http.ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  response.end(JSON.stringify(payload));
}

export async function createApiServer(options: { db: Database; port?: number }): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(async (request, response) => {
    response.setHeader('access-control-allow-origin', '*');
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      response.end();
      return;
    }

    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (!url.pathname.startsWith('/api/')) {
        writeJson(response, 404, { error: 'Only /api routes are served by the backend.' });
        return;
      }
      const result = await handleApiRequest({
        db: options.db,
        method: request.method ?? 'GET',
        pathname: url.pathname,
        request,
        response,
      });
      if (result.error) {
        writeJson(response, result.status ?? 400, { error: result.error });
      } else {
        writeJson(response, result.status ?? 200, { data: result.data });
      }
    } catch (error) {
      writeJson(response, 400, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 4000, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : options.port ?? 4000;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          try {
            options.db.close();
          } catch {
            // The HTTP server may own the only open handle during tests.
          }
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
