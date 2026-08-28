import { env } from '@/config/env';

import { setAuthToken } from './auth-token';

/**
 * Hand-rolled fetch calls against the backend's better-auth REST routes (`/api/auth/[...all]`).
 * These are NOT part of the oRPC router the generated schema.ts covers, so they can't go through
 * the typed apiClient — better-auth ships its own REST surface with its own error shape
 * (`{ message, code }`, no `status`/`defined`, unlike oRPC's `{ code, status, message, defined }`).
 */
const AUTH_BASE_URL = `${env.apiBaseUrl}/api/auth`;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  mustChangePassword: boolean;
}

export class AuthApiError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthApiError';
    this.code = code;
  }
}

interface BetterAuthErrorBody {
  message?: string;
  code?: string;
}

async function throwIfError(response: Response): Promise<void> {
  if (response.ok) return;

  let body: BetterAuthErrorBody = {};
  try {
    body = (await response.json()) as BetterAuthErrorBody;
  } catch {
    // Non-JSON error body — fall back to statusText below.
  }
  throw new AuthApiError(body.message ?? response.statusText, body.code);
}

/**
 * Signs in with email/password. Captures the `set-auth-token` response header — the bearer()
 * plugin mirrors the session cookie there for non-browser clients — and persists it via
 * setAuthToken before returning the session user.
 */
export async function signInWithEmail(email: string, password: string): Promise<SessionUser> {
  const response = await fetch(`${AUTH_BASE_URL}/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  await throwIfError(response);

  const token = response.headers.get('set-auth-token');
  if (!token) {
    throw new AuthApiError('Sign-in succeeded but no auth token was returned.');
  }
  await setAuthToken(token);

  const body = (await response.json()) as { user: SessionUser };
  return body.user;
}

/** Fetches the current session using the stored bearer token (attached by the caller via
 * Authorization header) — returns null when there is no active session (never throws for that). */
export async function getSession(token: string): Promise<SessionUser | null> {
  const response = await fetch(`${AUTH_BASE_URL}/get-session`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as { user: SessionUser } | null;
  return body?.user ?? null;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch(`${AUTH_BASE_URL}/forget-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, redirectTo: '/' }),
  });
  await throwIfError(response);
}

/** Changes the current user's password. Used for the forced mustChangePassword flow — the
 * backend's session-cookie rotation (nextCookies + revokeOtherSessions) doesn't apply to bearer
 * clients, so we re-fetch the session afterwards rather than relying on an updated cookie. */
export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const response = await fetch(`${AUTH_BASE_URL}/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
  });
  await throwIfError(response);
}

export async function signOut(token: string): Promise<void> {
  const response = await fetch(`${AUTH_BASE_URL}/sign-out`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  // Best-effort: even if the server call fails, the caller clears local token/state.
  if (!response.ok) {
    return;
  }
}

export type SocialProvider = 'google' | 'facebook';

/** The app's custom URL scheme (app.config.ts `scheme: 'chatbotxmobileapp'`) that the OAuth
 * broker relays back to once the provider flow completes. */
export const SOCIAL_CALLBACK_URL = 'chatbotxmobileapp://auth-callback';

/**
 * Starts a social sign-in flow. Shape per better-auth's `/sign-in/social` route: request
 * `{ provider, callbackURL }`, response `{ redirect: boolean; url: string }`.
 *
 * The returned `url` sends the user through the provider, then the backend's fixed OAuth
 * "broker" host relays back to `callbackURL`. `chatbotxmobileapp://` must be in the backend's
 * better-auth `trustedOrigins`.
 */
export async function startSocialSignIn(provider: SocialProvider): Promise<string> {
  const response = await fetch(`${AUTH_BASE_URL}/sign-in/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, callbackURL: SOCIAL_CALLBACK_URL }),
  });

  await throwIfError(response);

  const body = (await response.json()) as { redirect: boolean; url: string };
  return body.url;
}
