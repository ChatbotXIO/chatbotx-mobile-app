import * as Crypto from 'expo-crypto';

import { brand } from '@/config/brand';
import { env } from '@/config/env';
import { getMobileDeviceId } from '@/api/auth-device';

import { clearAuthToken, getAuthTokens, setAuthTokens, type AuthTokens } from './auth-token';

/**
 * Hand-rolled fetch calls against the backend's better-auth REST routes (`/api/auth/[...all]`).
 * These are NOT part of the oRPC router the generated schema.ts covers, so they can't go through
 * the typed apiClient — better-auth ships its own REST surface with its own error shape
 * (`{ message, code }`, no `status`/`defined`, unlike oRPC's `{ code, status, message, defined }`).
 */
const AUTH_BASE_URL = `${env.apiBaseUrl}/api/auth`;

/**
 * Headers for every POST to better-auth. React Native's native fetch shares the OS cookie jar, so
 * once the backend has set any cookie (e.g. the OAuth state cookie from `/sign-in/social`) later
 * requests carry it — and better-auth's CSRF check rejects a cookie-bearing request without an
 * `Origin` ("Missing or null Origin"). Native apps never send one, so we send the API's own
 * origin, which better-auth always trusts. Derived by regex because React Native's `URL` polyfill
 * doesn't implement `.origin`.
 */
const AUTH_ORIGIN = env.apiBaseUrl.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+/i)?.[0] ?? env.apiBaseUrl;
const AUTH_POST_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'application/json',
  Origin: AUTH_ORIGIN,
};

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
  mustChangePassword: boolean;
}

type MobileTokenResponse = AuthTokens;

export class AuthApiError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthApiError';
    this.code = code;
  }
}

interface AuthErrorBody {
  message?: string;
  code?: string;
}

async function throwIfError(response: Response): Promise<void> {
  if (response.ok) return;

  let body: AuthErrorBody = {};
  try {
    body = (await response.json()) as AuthErrorBody;
  } catch {
    // Non-JSON error body — fall back to statusText below.
  }
  throw new AuthApiError(body.message ?? response.statusText, body.code);
}

/** The mobile grant endpoint never creates a better-auth session. */
export async function signInWithEmail(email: string, password: string): Promise<SessionUser> {
  const response = await fetch(`${AUTH_BASE_URL}/mobile/token`, {
    method: 'POST',
    headers: AUTH_POST_HEADERS,
    body: JSON.stringify({
      deviceId: await getMobileDeviceId(),
      email,
      grantType: 'password',
      password,
    }),
  });

  await throwIfError(response);
  await setAuthTokens((await response.json()) as MobileTokenResponse);
  return getCurrentUser();
}

export async function getCurrentUser(accessToken?: string): Promise<SessionUser> {
  const token = accessToken ?? (await getValidAccessToken());
  if (!token) {
    throw new AuthApiError('Not signed in.', 'UNAUTHORIZED');
  }

  const response = await fetch(`${env.apiBaseUrl}/api/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfError(response);
  return (await response.json()) as SessionUser;
}

let refreshPromise: Promise<string> | null = null;

export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const tokens = await getAuthTokens();
    if (!tokens) {
      throw new AuthApiError('Not signed in.', 'UNAUTHORIZED');
    }

    const response = await fetch(`${AUTH_BASE_URL}/mobile/token`, {
      method: 'POST',
      headers: AUTH_POST_HEADERS,
      body: JSON.stringify({
        deviceId: await getMobileDeviceId(),
        grantType: 'refresh_token',
        refreshToken: tokens.refreshToken,
      }),
    });
    try {
      await throwIfError(response);
      const refreshed = (await response.json()) as MobileTokenResponse;
      await setAuthTokens(refreshed);
      return refreshed.accessToken;
    } catch (error) {
      await clearAuthToken();
      throw error;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

/** Proactively rotates short-lived access tokens when fewer than 60 seconds remain. */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getAuthTokens();
  if (!tokens) return null;
  if (tokens.expiresAt - Date.now() < 60_000) {
    return refreshAccessToken();
  }
  return tokens.accessToken;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch(`${AUTH_BASE_URL}/request-password-reset`, {
    method: 'POST',
    headers: AUTH_POST_HEADERS,
    body: JSON.stringify({ email, redirectTo: '/auth/reset-password' }),
  });
  await throwIfError(response);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new AuthApiError('Not signed in.', 'UNAUTHORIZED');
  }

  const response = await fetch(`${env.apiBaseUrl}/api/v1/me/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword, deviceId: await getMobileDeviceId() }),
  });
  await throwIfError(response);
  // Changing the password revokes every refresh token, including this device's; the response
  // carries a fresh pair so the user stays signed in here.
  await setAuthTokens((await response.json()) as MobileTokenResponse);
}

export async function revokeMobileToken(): Promise<void> {
  const tokens = await getAuthTokens();
  if (!tokens) return;

  await fetch(`${AUTH_BASE_URL}/mobile/revoke`, {
    method: 'POST',
    headers: AUTH_POST_HEADERS,
    body: JSON.stringify({
      deviceId: await getMobileDeviceId(),
      refreshToken: tokens.refreshToken,
    }),
  });
}

export type SocialProvider = 'google' | 'facebook';

/** The custom-scheme URL the backend redirects to with `?code=&state=` once the browser login
 * completes. */
export const SOCIAL_CALLBACK_URL = `${brand.brandScheme}://auth-callback`;

export interface SocialSignInStart {
  /** Provider authorization URL to open in the system browser. */
  url: string;
  /** Echoed back on the redirect; must match before the code is accepted. */
  state: string;
  /** PKCE verifier, sent with the code exchange. Never leaves the device before that. */
  codeVerifier: string;
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Starts the provider flow. The browser callback goes through the mobile one-time-code issuer
 * (no browser session is kept), protected by a PKCE challenge and a `state` value. */
export async function startSocialSignIn(provider: SocialProvider): Promise<SocialSignInStart> {
  const codeVerifier = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replaceAll('-', '');
  const state = Crypto.randomUUID();
  const challenge = toBase64Url(
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    }),
  );

  const callbackUrl =
    `${AUTH_BASE_URL}/mobile/callback?` +
    new URLSearchParams({
      redirect_uri: SOCIAL_CALLBACK_URL,
      code_challenge: challenge,
      device_id: await getMobileDeviceId(),
      state,
    }).toString();

  const response = await fetch(`${AUTH_BASE_URL}/sign-in/social`, {
    method: 'POST',
    headers: AUTH_POST_HEADERS,
    body: JSON.stringify({
      provider,
      callbackURL: callbackUrl,
      errorCallbackURL: callbackUrl,
    }),
  });

  await throwIfError(response);

  const body = (await response.json()) as { redirect: boolean; url: string };
  return { url: body.url, state, codeVerifier };
}

export async function exchangeSocialCode(code: string, codeVerifier: string): Promise<SessionUser> {
  const response = await fetch(`${AUTH_BASE_URL}/mobile/token`, {
    method: 'POST',
    headers: AUTH_POST_HEADERS,
    body: JSON.stringify({
      code,
      codeVerifier,
      deviceId: await getMobileDeviceId(),
      grantType: 'exchange_code',
    }),
  });
  await throwIfError(response);
  await setAuthTokens((await response.json()) as MobileTokenResponse);
  return getCurrentUser();
}

export interface AppleNonce {
  /** Sent to the backend, which hashes it and compares with the token's `nonce` claim. */
  raw: string;
  /** Lowercase SHA-256 hex of `raw`; this is what Apple embeds in the identity token. */
  hashed: string;
}

/** Generates the replay-protection nonce pair for native Sign in with Apple (expo-crypto only —
 * `crypto.subtle` doesn't exist on Hermes). */
export async function createAppleNonce(): Promise<AppleNonce> {
  const raw = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replaceAll('-', '');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

export interface AppleIdTokenInput {
  idToken: string;
  /** The RAW nonce (the hashed form went to Apple). */
  nonce: string;
  /** Apple only returns the name on the very first authorization, so forward it in that call. */
  firstName?: string | null;
  lastName?: string | null;
}

export async function signInWithAppleIdToken(input: AppleIdTokenInput): Promise<SessionUser> {
  const firstName = input.firstName?.trim() ?? '';
  const lastName = input.lastName?.trim() ?? '';
  const hasName = firstName !== '' || lastName !== '';

  const response = await fetch(`${AUTH_BASE_URL}/mobile/token`, {
    method: 'POST',
    headers: AUTH_POST_HEADERS,
    body: JSON.stringify({
      deviceId: await getMobileDeviceId(),
      grantType: 'id_token',
      idToken: input.idToken,
      nonce: input.nonce,
      provider: 'apple',
      ...(hasName ? { user: { name: { firstName, lastName } } } : {}),
    }),
  });
  await throwIfError(response);
  await setAuthTokens((await response.json()) as MobileTokenResponse);
  return getCurrentUser();
}
