import * as SecureStore from 'expo-secure-store';
import type { Middleware } from 'openapi-fetch';

import { apiClient } from '@/api/client';

// Jest hoists `jest.mock` calls above these imports at compile time regardless of source
// position, so this ordering (imports first, mocks after) is purely to satisfy `import/first` —
// it does not change which runs first.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiBaseUrl: 'http://localhost:3123',
        wsUrl: 'ws://localhost:3123',
        brandId: 'chatbotx',
        brandScheme: 'chatbotxmobileapp',
        brandColor: '#3c6df0',
      },
    },
  },
}));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn() }));

/**
 * Stand-in for React Native's second `Response` realm (see the plan this test accompanies):
 * duck-types a Response but is never `instanceof` the global `Response` openapi-fetch checks
 * against, which is exactly the mismatch that produced
 * "onResponse: must return new Response() when modifying the response".
 */
class ForeignResponse {
  constructor(
    private readonly bodyText: string,
    private readonly init: ResponseInit = {},
  ) {}
  get status() {
    return this.init.status ?? 200;
  }
  get statusText() {
    return this.init.statusText ?? '';
  }
  get headers() {
    return new Headers(this.init.headers);
  }
  async text() {
    return this.bodyText;
  }
  async json() {
    return JSON.parse(this.bodyText);
  }
}

describe('apiClient', () => {
  let fetchMock: jest.Mock;
  let serverResponse: Response;

  beforeEach(() => {
    serverResponse = new Response(JSON.stringify({ id: '123' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    fetchMock = jest.fn().mockResolvedValue(serverResponse);
  });

  it('does not throw the RN dual-Response error, because no onResponse middleware is registered', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);

    const result = await apiClient.GET('/analytics/broadcasts/{broadcastId}/stats', {
      params: { path: { broadcastId: '1' }, query: { workspaceId: 'w1' } },
      fetch: fetchMock,
    });

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ id: '123' });
  });

  it('regression: a rewrapping onResponse middleware reproduces the exact RN dual-Response error', async () => {
    // Proves the mechanism this suite guards against: only a middleware that reconstructs the
    // response (as the deleted bigNumberSafeParsingMiddleware did) can trigger openapi-fetch's
    // `instanceof Response` check. If such a middleware is ever reintroduced against a
    // foreign-realm Response class, it fails exactly like the original bug.
    const rewrapMiddleware: Middleware = {
      async onResponse({ response }) {
        const raw = await response.text();
        return new ForeignResponse(raw, { status: response.status }) as unknown as Response;
      },
    };
    apiClient.use(rewrapMiddleware);
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);

    try {
      await expect(
        apiClient.GET('/analytics/broadcasts/{broadcastId}/stats', {
          params: { path: { broadcastId: '1' }, query: { workspaceId: 'w1' } },
          fetch: fetchMock,
        }),
      ).rejects.toThrow('onResponse: must return new Response() when modifying the response');
    } finally {
      apiClient.eject(rewrapMiddleware);
    }
  });

  it('sets Authorization: Bearer <token> when getAuthToken resolves a token', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('test-token');

    await apiClient.GET('/analytics/broadcasts/{broadcastId}/stats', {
      params: { path: { broadcastId: '1' }, query: { workspaceId: 'w1' } },
      fetch: fetchMock,
    });

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('leaves the Authorization header unset when getAuthToken resolves null', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);

    await apiClient.GET('/analytics/broadcasts/{broadcastId}/stats', {
      params: { path: { broadcastId: '1' }, query: { workspaceId: 'w1' } },
      fetch: fetchMock,
    });

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.headers.has('Authorization')).toBe(false);
  });
});
