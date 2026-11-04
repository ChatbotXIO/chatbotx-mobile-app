import { getValidAccessToken } from '@/api/auth-endpoints';

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
        brandId: 'chatbotx',
        brandScheme: 'chatbotxmobileapp',
        brandColor: '#3c6df0',
      },
    },
  },
}));
jest.mock('@/api/auth-endpoints', () => ({
  getValidAccessToken: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

/** A response from React Native's fetch realm, which is not an instance of the Response class
 * that openapi-fetch captures while it initializes. */
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
  get ok() {
    return this.status >= 200 && this.status < 300;
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
    jest.mocked(getValidAccessToken).mockResolvedValue(null);
  });

  it('accepts a response from React Native without passing it through onResponse', async () => {
    fetchMock.mockResolvedValueOnce(
      new ForeignResponse(JSON.stringify({ id: '123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await apiClient.GET('/v1/contacts/{identifier}', {
      params: { path: { identifier: 'id:1' } },
      fetch: fetchMock,
    });

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ id: '123' });
  });

  it('retries a 401 mutation without returning the retried response through onResponse', async () => {
    const originalFetch = global.fetch;
    const requestBodies: string[] = [];
    const globalFetch = jest
      .fn()
      .mockImplementationOnce(async (request: Request) => {
        requestBodies.push(await request.text());
        return new ForeignResponse('', { status: 401 });
      })
      .mockImplementationOnce(async (request: Request) => {
        requestBodies.push(await request.text());
        return new ForeignResponse(JSON.stringify({ id: '123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      });
    global.fetch = globalFetch;
    jest.resetModules();

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- reload after replacing global fetch.
      const { apiClient: isolatedClient } = require('@/api/client') as typeof import('@/api/client');
      const auth = jest.requireMock('@/api/auth-endpoints') as {
        getValidAccessToken: jest.Mock;
        refreshAccessToken: jest.Mock;
      };
      auth.getValidAccessToken.mockResolvedValue('expired-access-token');
      auth.refreshAccessToken.mockResolvedValue('fresh-access-token');

      await expect(
        isolatedClient.POST('/v1/contacts', {
          body: { displayName: 'Ada' },
        } as never),
      ).resolves.toMatchObject({ data: { id: '123' } });

      expect(globalFetch).toHaveBeenCalledTimes(2);
      expect(requestBodies).toEqual(['{"displayName":"Ada"}', '{"displayName":"Ada"}']);
      const retryRequest = globalFetch.mock.calls[1][0] as Request;
      expect(retryRequest.headers.get('Authorization')).toBe('Bearer fresh-access-token');
      expect(retryRequest.headers.get('x-mobile-refresh-retry')).toBe('1');
    } finally {
      global.fetch = originalFetch;
      jest.resetModules();
    }
  });

  it('sets Authorization: Bearer <token> when getValidAccessToken resolves a token', async () => {
    jest.mocked(getValidAccessToken).mockResolvedValueOnce('test-token');

    await apiClient.GET('/v1/contacts/{identifier}', {
      params: { path: { identifier: 'id:1' } },
      fetch: fetchMock,
    });

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('leaves the Authorization header unset when getValidAccessToken resolves null', async () => {
    await apiClient.GET('/v1/contacts/{identifier}', {
      params: { path: { identifier: 'id:1' } },
      fetch: fetchMock,
    });

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.headers.has('Authorization')).toBe(false);
  });

  it('serializes status/tags/contactFilter as JSON strings and other params as plain values', async () => {
    await apiClient.GET('/v1/conversations', {
      params: { query: { tags: ['unread', 'archived'], keyword: 'hi', perPage: 30 } },
      fetch: fetchMock,
    });

    const url = new URL((fetchMock.mock.calls[0][0] as Request).url);
    expect(url.searchParams.get('tags')).toBe('["unread","archived"]');
    expect(url.searchParams.get('keyword')).toBe('hi');
    expect(url.searchParams.get('perPage')).toBe('30');
  });

  it('repeats other array params and drops null/undefined values', async () => {
    await apiClient.GET('/v1/contacts', {
      params: { query: { include: ['tags', 'inboxes'], keyword: undefined, page: null } },
      fetch: fetchMock,
    });

    const url = new URL((fetchMock.mock.calls[0][0] as Request).url);
    expect(url.searchParams.getAll('include')).toEqual(['tags', 'inboxes']);
    expect(url.searchParams.has('keyword')).toBe(false);
    expect(url.searchParams.has('page')).toBe(false);
  });
});
