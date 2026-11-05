import createClient, { type Middleware } from 'openapi-fetch';

import { getValidAccessToken, refreshAccessToken } from '@/api/auth-endpoints';
import { env } from '@/config/env';
import { useWorkspaceStore } from '@/stores/use-workspace-store';

import type { paths } from './generated/schema';

/**
 * Adds the mobile credential and selected workspace to every public API call.
 * The request is retried once after a 401, after the shared refresh flight
 * completes, so concurrent calls cannot rotate the refresh token repeatedly.
 */
async function fetchWithAuthRetry(request: Request): Promise<Response> {
  const retryRequest =
    request.method === 'GET' || request.method === 'HEAD' ? null : request.clone();
  const response = await fetch(request);
  if (response.status !== 401 || request.headers.has('x-mobile-refresh-retry')) {
    return response;
  }

  try {
    const token = await refreshAccessToken();
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('x-mobile-refresh-retry', '1');
    return await fetch(new Request(retryRequest ?? request, { headers }));
  } catch {
    return response;
  }
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = await getValidAccessToken();
    const workspaceId = useWorkspaceStore.getState().currentWorkspaceId;

    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    if (workspaceId) {
      request.headers.set('x-workspace-id', workspaceId);
    }

    return request;
  },
};

/** Query params the API accepts as a single JSON-encoded string (`status=["unread"]`); bracketed
 * JSON-string keys such as `status[0]=unread` are silently ignored by the server. */
const JSON_QUERY_KEYS: Record<string, true> = {
  contactFilter: true,
  sort: true,
  status: true,
  tags: true,
};

function querySerializer(query: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (JSON_QUERY_KEYS[key] && typeof value === 'object') {
      params.append(key, JSON.stringify(value));
      continue;
    }

    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      params.append(key, String(item));
    }
  }

  return params.toString();
}

/**
 * Typed fetch client for the ChatbotX REST API, generated from its OpenAPI spec.
 * Run `pnpm generate:api` to (re)generate src/api/generated/schema.ts against a running backend.
 *
 * All public API routes are versioned under `/api/v1`. Auth remains under
 * `/api/auth`; multipart uploads use the same generated client as all other
 * versioned endpoints.
 */
export const apiClient = createClient<paths>({
  baseUrl: `${env.apiBaseUrl}/api`,
  fetch: fetchWithAuthRetry,
  querySerializer,
});

apiClient.use(authMiddleware);
