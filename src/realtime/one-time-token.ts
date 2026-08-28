import { env } from '@/config/env';

/**
 * `GET /api/auth/one-time-token/generate` — better-auth's `oneTimeToken()` plugin (enabled on the
 * backend). Hand-rolled fetch, same pattern as api/auth-endpoints.ts, since this isn't part of
 * the oRPC-generated apiClient.
 */
export class OneTimeTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OneTimeTokenError';
  }
}

export async function generateOneTimeToken(bearerToken: string): Promise<string> {
  const response = await fetch(`${env.apiBaseUrl}/api/auth/one-time-token/generate`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  if (!response.ok) {
    throw new OneTimeTokenError(`Failed to generate one-time token (${response.status})`);
  }

  const body = (await response.json()) as { token?: string } | null;
  if (!body?.token) {
    throw new OneTimeTokenError('One-time token response missing "token" field.');
  }

  return body.token;
}
