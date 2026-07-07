import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

import type { Database } from './db.ts';
import { handleApiRequest } from './apiRoutes.ts';
import { apiErrorPayload, inferErrorCode, notFound, toApiError } from './errors.ts';

type ApiServerOptions = {
  db: Database;
  port?: number;
  host?: string;
  staticDir?: string;
};

function writeJson(response: http.ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
      'access-control-allow-headers': 'content-type,x-haina-role,x-haina-actor',
  });
  response.end(JSON.stringify(payload));
}

function contentType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
}

function staticFilePath(staticDir: string, pathname: string): string | null {
  const root = resolve(staticDir);
  const relativePath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const candidate = normalize(join(root, relativePath));
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  const indexPath = join(root, 'index.html');
  return existsSync(indexPath) ? indexPath : null;
}

function serveStatic(response: http.ServerResponse, filePath: string): void {
  response.writeHead(200, { 'content-type': contentType(filePath) });
  createReadStream(filePath).pipe(response);
}

export async function createApiServer(options: ApiServerOptions): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(async (request, response) => {
    response.setHeader('access-control-allow-origin', '*');
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
        'access-control-allow-headers': 'content-type,x-haina-role,x-haina-actor',
      });
      response.end();
      return;
    }

    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (!url.pathname.startsWith('/api/')) {
        if (options.staticDir && (request.method === 'GET' || request.method === 'HEAD')) {
          const filePath = staticFilePath(options.staticDir, url.pathname);
          if (filePath) {
            serveStatic(response, filePath);
            return;
          }
        }
        writeJson(response, 404, apiErrorPayload(notFound('Only /api routes are served by the backend.')));
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
        const status = result.status ?? 400;
        writeJson(response, status, { error: result.error, code: result.errorCode ?? inferErrorCode(status) });
      } else if (result.handled) {
        return;
      } else {
        writeJson(response, result.status ?? 200, { data: result.data });
      }
    } catch (error) {
      const apiError = toApiError(error);
      writeJson(response, apiError.status, apiErrorPayload(apiError));
    }
  });

  const host = options.host ?? '127.0.0.1';
  await new Promise<void>((resolve) => server.listen(options.port ?? 4000, host, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : options.port ?? 4000;
  const baseHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  return {
    baseUrl: `http://${baseHost}:${port}`,
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
