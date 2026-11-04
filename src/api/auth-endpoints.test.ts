import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { refreshAccessToken, startSocialSignIn } from '@/api/auth-endpoints';
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
});
