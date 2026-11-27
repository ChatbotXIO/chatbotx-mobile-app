import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { parseRetryAfterMs } from '@/api/retry-after';

import { RealtimeFatalError, RealtimeRetryAfterError } from './protocol/realtime-socket';

/** Mints a short-lived connect token and returns the workspace-specific socket URL.
 *
 * Failure mapping drives the socket's reconnect policy: a 4xx (other than 429) is fatal — retrying
 * the same request can't change the outcome; a 429 with a usable wait becomes a
 * `RealtimeRetryAfterError` so the socket honors the server's window; anything else is thrown as an
 * `ApiError` and retried with backoff. */
export async function mintRealtimeUrl(lastSeq: string | null): Promise<string> {
  const { data, error, response } = await apiClient.GET('/v1/realtime/connect-token');
  if (error) {
    const apiError = new ApiError(error);
    const status = apiError.body.status;
    if (status && status >= 400 && status < 500 && status !== 429) {
      throw new RealtimeFatalError(apiError.message);
    }
    if (status === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'), apiError.message);
      if (retryAfterMs !== null) {
        throw new RealtimeRetryAfterError(apiError.message, retryAfterMs);
      }
    }
    throw apiError;
  }

  const url = new URL(data.socketUrl);
  url.searchParams.set('token', data.token);
  if (lastSeq) url.searchParams.set('lastSeq', lastSeq);
  return url.toString();
}
