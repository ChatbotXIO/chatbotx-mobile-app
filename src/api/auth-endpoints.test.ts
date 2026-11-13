import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import {
  AuthApiError,
  createAppleNonce,
  refreshAccessToken,
  requestPasswordReset,
  signInWithAppleIdToken,
  startSocialSignIn,
} from '@/api/auth-endpoints';
import { getMobileDeviceId } from '@/api/auth-device';
import { setAuthTokens } from '@/api/auth-token';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiBaseUrl: 'https://api.example.test',
        brandColor: '#000000',
        brandId: 'test-brand',
        brandScheme: 'test-brand',
      },
    },
  },
}));
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { BASE64: 'base64' },
  digestStringAsync: jest.fn(),
  randomUUID: jest.fn(),
}));
jest.mock('@/api/auth-device', () => ({
  getMobileDeviceId: jest.fn(),
}));

describe('refreshAccessToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shares one refresh request among concurrent callers', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({
        accessToken: 'expired-access-token',
        expiresAt: Date.now() - 1,
        refreshToken: 'refresh-token',
      }),
    );
    const setToken = jest.mocked(SecureStore.setItemAsync);
    setToken.mockResolvedValue();
    await setAuthTokens({
      accessToken: 'expired-access-token',
      expiresAt: Date.now() - 1,
      refreshToken: 'refresh-token',
    });
    setToken.mockClear();

    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: 'new-access-token',
          expiresAt: Date.now() + 10 * 60_000,
          refreshToken: 'new-refresh-token',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    await expect(
      Promise.all([refreshAccessToken(), refreshAccessToken(), refreshAccessToken()]),
    ).resolves.toEqual(['new-access-token', 'new-access-token', 'new-access-token']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setToken).toHaveBeenCalledWith(
      'test-brand.authTokens',
      expect.stringContaining('new-access-token'),
    );
  });
});

describe('startSocialSignIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a 43-character base64url challenge for its valid PKCE verifier', async () => {
    jest
      .mocked(Crypto.randomUUID)
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
      .mockReturnValueOnce('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    jest
      .mocked(Crypto.digestStringAsync)
      .mockResolvedValue('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=');
    jest.mocked(getMobileDeviceId).mockResolvedValue('device-1');
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ redirect: true, url: 'https://provider.example.test/login' }), {
        status: 200,
      }),
    );

    const result = await startSocialSignIn('google');

    const verifier = result.codeVerifier;
    const body = JSON.parse(jest.mocked(global.fetch).mock.calls[0]![1]!.body as string) as {
      callbackURL: string;
    };
    const callback = new URL(body.callbackURL);

    expect(verifier).toHaveLength(64);
    expect(verifier).toMatch(/^[A-Za-z0-9._~-]+$/);
    expect(callback.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('sends the API origin so better-auth accepts the request when the native cookie jar attached cookies', async () => {
    jest.mocked(Crypto.randomUUID).mockReturnValue('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    jest
      .mocked(Crypto.digestStringAsync)
      .mockResolvedValue('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=');
    jest.mocked(getMobileDeviceId).mockResolvedValue('device-1');
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ redirect: true, url: 'https://provider.example.test/login' }), {
        status: 200,
      }),
    );

    await startSocialSignIn('google');

    const init = jest.mocked(global.fetch).mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).Origin).toBe('https://api.example.test');
  });
});

describe('requestPasswordReset', () => {
  it('posts to the request-password-reset route with the web reset page as redirect', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await requestPasswordReset('a@b.test');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/request-password-reset$/);
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'a@b.test',
      redirectTo: '/auth/reset-password',
    });
  });
});

describe('createAppleNonce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a dashless raw nonce and its SHA-256 hex digest', async () => {
    jest
      .mocked(Crypto.randomUUID)
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    jest.mocked(Crypto.digestStringAsync).mockResolvedValue('deadbeef');

    const nonce = await createAppleNonce();

    expect(nonce.raw).toBe('aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaabbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb');
    expect(nonce.hashed).toBe('deadbeef');
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', nonce.raw);
  });
});

describe('signInWithAppleIdToken', () => {
  const tokens = {
    accessToken: 'access',
    expiresAt: Date.now() + 10 * 60_000,
    refreshToken: 'refresh',
  };
  const me = { id: 'u1', email: 'a@b.test', name: 'Ada Lovelace', mustChangePassword: false };

  function mockSuccessfulFetch() {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(tokens), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(me), { status: 200 }));
    global.fetch = fetchMock;
    return fetchMock;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getMobileDeviceId).mockResolvedValue('device-1');
    jest.mocked(SecureStore.setItemAsync).mockResolvedValue();
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(tokens));
  });

  it('posts the id_token grant with the raw nonce and device id', async () => {
    const fetchMock = mockSuccessfulFetch();

    await signInWithAppleIdToken({
      idToken: 'id-token',
      nonce: 'raw-nonce',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.example.test/api/auth/mobile/token');
    expect(JSON.parse(init.body as string)).toEqual({
      deviceId: 'device-1',
      grantType: 'id_token',
      idToken: 'id-token',
      nonce: 'raw-nonce',
      provider: 'apple',
      user: { name: { firstName: 'Ada', lastName: 'Lovelace' } },
    });
  });

  it('omits user when Apple sent no name', async () => {
    const fetchMock = mockSuccessfulFetch();

    await signInWithAppleIdToken({
      idToken: 'id-token',
      nonce: 'raw-nonce',
      firstName: null,
      lastName: '',
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty('user');
  });

  it('stores the tokens and returns the current user', async () => {
    mockSuccessfulFetch();

    const user = await signInWithAppleIdToken({ idToken: 'id-token', nonce: 'raw-nonce' });

    expect(user).toEqual(me);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'test-brand.authTokens',
      expect.stringContaining('access'),
    );
  });

  it('surfaces the backend error code', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Bad token', code: 'INVALID_ID_TOKEN' }), {
        status: 401,
      }),
    );

    await expect(
      signInWithAppleIdToken({ idToken: 'id-token', nonce: 'raw-nonce' }),
    ).rejects.toEqual(expect.objectContaining<Partial<AuthApiError>>({ code: 'INVALID_ID_TOKEN' }));
  });
});
