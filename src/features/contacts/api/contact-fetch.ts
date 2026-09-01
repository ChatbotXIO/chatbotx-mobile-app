import { getAuthToken } from '@/api/auth-token';

/** Shared by every hand-rolled contact-mutation fetch in this feature (block/unblock, delete) —
 * see each hook's own doc comment for why a hand-rolled fetch exists instead of the generated
 * client. Aborts the request after `FETCH_TIMEOUT_MS` so a stalled connection can't hang a
 * mutation (and its optimistic-update rollback) indefinitely. */
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Attaches the bearer token (when present), enforces a timeout via `AbortController`, and
 * normalizes a non-ok response into a thrown `Error` using the server's `message` field when the
 * error body is JSON (falling back to `response.statusText` otherwise).
 */
export async function authorizedFetch(
  url: string,
  init: Omit<RequestInit, 'signal'> = {},
): Promise<void> {
  const token = await getAuthToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      const errorBody = (await response.json()) as { message?: string };
      message = errorBody.message ?? message;
    } catch {
      // Non-JSON error body — fall back to statusText.
    }
    throw new Error(message);
  }
}
