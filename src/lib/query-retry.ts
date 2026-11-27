import { ApiError } from '@/api/errors';
import { parseRetryAfterMs } from '@/api/retry-after';

export const DEFAULT_RETRY_DELAY_MS = 1_000;

/** Skip retrying 4xx responses — they're the server telling us the request itself is wrong
 * (bad input, unauthorized, not found, blocked), and retrying identically can't change that
 * outcome. 429 is the exception: the request is fine, the per-user rate-limit window is just
 * full, so one retry after the server's `Retry-After` usually succeeds. Everything else (network
 * blips, 5xx) is retried once. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    const status = error.body.status;
    if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
      return false;
    }
  }
  return failureCount < 1;
}

/** Waits the server-requested `Retry-After` on a 429; otherwise a short fixed delay. */
export function retryDelay(_failureCount: number, error: unknown): number {
  if (error instanceof ApiError && error.body.status === 429) {
    return parseRetryAfterMs(null, error.message) ?? DEFAULT_RETRY_DELAY_MS;
  }
  return DEFAULT_RETRY_DELAY_MS;
}
